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
    http::{self, google::GoogleConfig, payment::StripeConfig},
    repo,
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

    /* 구글과 Stripe 는 자격증명이 있을 때만 켠다.

    없다고 서버가 안 뜨면 DB 만 있으면 되는 로컬 개발이 막힌다. 대신 어느
    기능이 꺼졌는지 부팅 로그에 남긴다 — 조용히 꺼져 있으면 나중에 눌렀을
    때 왜 안 되는지 알 수가 없다. */
    let google = GoogleConfig::from_env();
    let stripe = StripeConfig::from_env();
    if google.is_none() {
        tracing::warn!(
            "google sign-in is off: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
        );
    }
    if stripe.is_none() {
        tracing::warn!("payments are off: set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET");
    }

    /* 쿠키에 Secure 를 붙일지는 배포 환경이 정한다. 로컬은 http 라 붙이면
    브라우저가 쿠키를 아예 안 보내서 로그인이 안 된다. 기본은 켜 둔다 —
    빠뜨렸을 때 안전한 쪽으로 틀리는 게 낫다. */
    let secure_cookies = std::env::var("INSECURE_COOKIES").is_err();

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
        }),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("server error")?;
    Ok(())
}

async fn shutdown_signal() {
    if let Err(e) = tokio::signal::ctrl_c().await {
        tracing::error!(error = ?e, "failed to install ctrl-c handler");
    }
    tracing::info!("shutting down");
}
