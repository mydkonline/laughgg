//! HTTP 경계 — 라우팅과 직렬화.
//!
//! 여기서만 상태 코드와 JSON 모양을 정한다. 판정은 [`crate::domain`] 이,
//! 질의는 [`crate::repo`] 가 한다. 핸들러가 SQL 을 직접 쓰기 시작하면
//! 그 순간 세 계층이 하나로 붙는다.

mod asset;
mod error;
mod game;
mod metrics;

use axum::{
    Router,
    routing::{get, post},
};
use sqlx::PgPool;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};

pub use error::ApiResult;

/// 핸들러가 공유하는 상태. 지금은 풀 하나뿐이다.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

/// API 라우터와 정적 파일 서빙을 조립한다.
pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/assets", get(asset::list).post(asset::create))
        // 등록과 재검수는 다른 일이라 경로도 다르다. 한때 둘이 같은 핸들러를
        // 가리켜서 재검수를 부르면 에셋이 하나 더 생겼다.
        .route("/assets/{id}/review", post(asset::review))
        .route("/games", get(game::list))
        .route("/metrics", get(metrics::get))
        .with_state(state);

    Router::new()
        .nest("/api", api)
        .fallback_service(ServeDir::new("web").append_index_html_on_directories(true))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

async fn health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "status": "ok", "service": "laughgg-api" }))
}
