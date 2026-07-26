//! `IndyGG` API 서버.
//!
//! 게임 에셋 마켓의 백엔드다. 창작자가 에셋을 올리면 7개 항목을 채점해 등급을 매기고,
//! 게임 스튜디오가 구독으로 카탈로그에 접근한다. 수수료는 8% 단일이며 주 수익원은 구독이다.

mod db;
mod domain;

use std::net::SocketAddr;

use anyhow::{Context as _, Result};
use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::json;
use sqlx::SqlitePool;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};

use crate::db::{AssetQuery, NewAsset};

#[derive(Clone)]
struct AppState {
    pool: SqlitePool,
}

/// HTTP 경계에서의 오류. 내부 사정은 로그로 남기고 클라이언트에는 요약만 준다.
struct ApiError(anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        tracing::error!(error = ?self.0, "request failed");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": self.0.to_string() })),
        )
            .into_response()
    }
}

impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

type ApiResult<T> = Result<T, ApiError>;

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "service": "indygg-api" }))
}

async fn get_assets(
    State(st): State<AppState>,
    Query(q): Query<AssetQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let rows = db::list_assets(&st.pool, &q).await?;
    Ok(Json(json!({ "count": rows.len(), "assets": rows })))
}

async fn post_asset(
    State(st): State<AppState>,
    Json(input): Json<NewAsset>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let result = db::create_asset(&st.pool, &input).await?;
    Ok((StatusCode::CREATED, Json(json!(result))))
}

#[derive(serde::Deserialize)]
struct GameQuery {
    platform: Option<String>,
}

async fn get_games(
    State(st): State<AppState>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let rows = db::list_games(&st.pool, q.platform.as_deref()).await?;
    Ok(Json(json!({ "count": rows.len(), "games": rows })))
}

async fn get_metrics(State(st): State<AppState>) -> ApiResult<Json<serde_json::Value>> {
    let m = db::metrics(&st.pool).await?;
    Ok(Json(json!(m)))
}

fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/assets", get(get_assets).post(post_asset))
        .route("/review", post(post_asset))
        .route("/games", get(get_games))
        .route("/metrics", get(get_metrics))
        .with_state(state);

    Router::new()
        .nest("/api", api)
        .fallback_service(ServeDir::new("web").append_index_html_on_directories(true))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "indygg_api=info,tower_http=info".into()),
        )
        .init();

    let db_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:indygg.db?mode=rwc".into());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8420);

    let pool = db::connect(&db_url).await?;
    tracing::info!(%db_url, "database ready");

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!("listening on http://{addr}");

    axum::serve(listener, router(AppState { pool }))
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
