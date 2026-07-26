//! `LaughGG` API 서버.
//!
//! 게임 에셋 마켓의 백엔드다. 창작자가 에셋을 올리면 7개 항목을 채점해 배지를 매기고,
//! 게임 스튜디오가 구독으로 카탈로그에 접근한다. 수수료는 8% 단일이며 주 수익원은 구독이다.
//! 저장소는 `PostgreSQL` 16 이상을 쓴다.
//!
//! 계층은 셋이고 의존은 한 방향이다.
//!   [`domain`]  판정과 계산. 바깥을 모른다.
//!   [`repo`]    Postgres 질의. `domain` 만 안다.
//!   [`http`]    라우팅과 직렬화. 둘 다 안다.
//!
//! 이 파일은 부팅만 한다 — 설정을 읽고, 풀을 열고, 라우터를 띄운다.

mod domain;
mod http;
mod repo;

use std::net::SocketAddr;

use anyhow::{Context as _, Result};

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

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!("listening on http://{addr}");

    axum::serve(listener, http::router(http::AppState { pool }))
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
