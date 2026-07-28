//! `LaughGG` API 서버.
//!
//! 게임 에셋 마켓의 백엔드다. 창작자가 에셋을 올리면 7개 항목을 채점해 배지를 매기고,
//! 게임 스튜디오가 구독으로 카탈로그에 접근한다. 수수료는 8% 단일이며 주 수익원은 구독이다.
//! 저장소는 `PostgreSQL` 16 이상을 쓴다.
//!
//! 이 파일은 부팅만 한다 — 설정을 읽고, 풀을 열고, 라우터를 띄운다.
//! 계층 구조는 [`laughgg_api`] 를 본다.

use std::net::SocketAddr;

use anyhow::{Context as _, Result};
use laughgg_api::{
    http::{self, oauth::google::GoogleConfig, payment::StripeConfig, upload::StorageConfig},
    provider::meshy::Meshy,
    repo, worker,
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "laughgg_api=info,tower_http=info".into()),
        )
        .init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://laughgg:laughgg@127.0.0.1:5432/laughgg".into());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8420);

    let pool = repo::connect(&db_url).await?;
    tracing::info!("database ready");

    /* 관리자 계정을 심는다.

    비번은 env 로 정하고, 안 주면 데모용 기본값을 쓴다. 부팅마다 upsert 라
    이미 있어도 비번을 그 값으로 다시 맞춘다 — 그래서 "정해 둔 자격으로
    무조건 로그인" 이 재부팅 뒤에도 지켜진다. 진짜 운영이면 ADMIN_PASSWORD 를
    반드시 넘겨서 기본값을 덮어야 한다. */
    let admin_email = std::env::var("ADMIN_EMAIL").unwrap_or_else(|_| "admin@laughgg.io".into());
    let admin_password =
        std::env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "laughgg-admin-2026".into());
    match repo::seed_admin(&pool, &admin_email, &admin_password, "Admin").await {
        Ok(id) => tracing::info!(admin_id = id, admin_email, "admin account ready"),
        Err(e) => tracing::error!("seeding admin failed: {e}"),
    }

    /* 워커 모드.

    같은 바이너리를 --worker 로 띄우면 API 를 안 열고 큐만 돈다. 생성
    작업이 밀려도 API 응답이 안 느려지려면 그 둘이 같은 스레드 풀을
    안 써야 한다. */
    if std::env::args().any(|a| a == "--worker") {
        let Some(generator) = Meshy::from_env() else {
            anyhow::bail!("worker needs MESHY_API_KEY");
        };
        let worker_id = std::env::var("WORKER_ID")
            .unwrap_or_else(|_| format!("{}-{}", hostname(), std::process::id()));

        let (tx, rx) = tokio::sync::watch::channel(false);
        tokio::spawn(async move {
            shutdown_signal().await;
            let _ = tx.send(true);
        });
        return worker::run(pool, generator, worker_id, rx).await;
    }

    /* 구글과 Stripe 는 자격증명이 있을 때만 켠다.

    없다고 서버가 안 뜨면 DB 만 있으면 되는 로컬 개발이 막힌다. 대신 어느
    기능이 꺼졌는지 부팅 로그에 남긴다 — 조용히 꺼져 있으면 나중에 눌렀을
    때 왜 안 되는지 알 수가 없다. */
    let google = GoogleConfig::from_env();
    let stripe = StripeConfig::from_env();
    let storage = StorageConfig::from_env();
    if google.is_none() {
        tracing::warn!(
            "google sign-in is off: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
        );
    }
    if stripe.is_none() {
        tracing::warn!("payments are off: set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET");
    }
    if storage.is_none() {
        tracing::warn!("uploads are off: set STORAGE_UPLOAD_URL");
    }

    /* 쿠키에 Secure 를 붙일지는 배포 환경이 정한다. 로컬은 http 라 붙이면
    브라우저가 쿠키를 아예 안 보내서 로그인이 안 된다. 기본은 켜 둔다 —
    빠뜨렸을 때 안전한 쪽으로 틀리는 게 낫다. */
    let secure_cookies = std::env::var("INSECURE_COOKIES").is_err();

    /* 프런트가 다른 도메인에 있으면 그 주소를 적어 줘야 쿠키가 실린다.
    쉼표로 여럿. 안 적으면 CORS 를 안 연다 — 같은 도메인이면 필요 없고,
    필요 없는데 열어 두면 그게 구멍이다. */
    let cors_origins: Vec<String> = std::env::var("CORS_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect();
    if cors_origins.is_empty() {
        tracing::info!("CORS is closed; set CORS_ORIGINS if the front end is on another domain");
    } else {
        tracing::info!(?cors_origins, "CORS open for these origins");
    }

    // 만료된 세션은 부팅할 때 한 번 치운다. 안 치우면 테이블이 영원히 자란다.
    match repo::purge_expired_sessions(&pool).await {
        Ok(n) if n > 0 => tracing::info!(purged = n, "expired sessions removed"),
        Ok(_) => {}
        Err(e) => tracing::warn!(error = ?e, "could not purge expired sessions"),
    }

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!("listening on http://{addr}");

    axum::serve(
        listener,
        http::router(http::AppState {
            pool,
            secure_cookies,
            google,
            stripe,
            storage,
            cors_origins,
        }),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("server error")?;
    Ok(())
}

/// 호스트 이름. 워커 id 에 넣어 어느 노드가 잡았는지 로그에서 보이게 한다.
fn hostname() -> String {
    std::env::var("HOSTNAME").unwrap_or_else(|_| "worker".to_owned())
}

async fn shutdown_signal() {
    if let Err(e) = tokio::signal::ctrl_c().await {
        tracing::error!(error = ?e, "failed to install ctrl-c handler");
    }
    tracing::info!("shutting down");
}
