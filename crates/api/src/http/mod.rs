//! HTTP 경계 — 라우팅과 직렬화.
//!
//! 여기서만 상태 코드와 JSON 모양을 정한다. 판정은 [`crate::domain`] 이,
//! 질의는 [`crate::repo`] 가 한다. 핸들러가 SQL 을 직접 쓰기 시작하면
//! 그 순간 세 계층이 하나로 붙는다.

mod asset;
pub mod auth;
mod error;
mod game;
pub mod google;
mod metrics;
pub mod payment;
mod sale;

use axum::{
    Router,
    routing::{get, post},
};
use sqlx::PgPool;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};

pub use error::{ApiError, ApiResult};

/// 핸들러가 공유하는 상태.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    /// 세션 쿠키에 Secure 를 붙이는가. 로컬 개발은 http 라 못 붙인다.
    pub secure_cookies: bool,
    pub google: Option<crate::http::google::GoogleConfig>,
    pub stripe: Option<crate::http::payment::StripeConfig>,
}

impl AppState {
    /// 외부 연동 없이 DB 만 물린 상태.
    ///
    /// 구글과 Stripe 를 끈 채로도 나머지가 다 돌아야 한다. 로컬 개발과
    /// 테스트가 남의 자격증명을 요구하기 시작하면 아무도 안 돌린다.
    #[must_use]
    pub fn bare(pool: PgPool) -> Self {
        Self {
            pool,
            secure_cookies: false,
            google: None,
            stripe: None,
        }
    }
}

/// API 라우터와 정적 파일 서빙을 조립한다.
pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/auth/signup", post(auth::sign_up))
        .route("/auth/login", post(auth::log_in))
        .route("/auth/logout", post(auth::log_out))
        .route("/auth/me", get(auth::me))
        .route("/auth/google", get(google::start))
        .route("/auth/google/callback", get(google::callback))
        // 결제창은 Stripe 가 띄운다. 여기로는 카드 정보가 오지 않는다.
        .route("/assets/{id}/checkout", post(payment::checkout))
        .route("/orders", get(payment::my_orders))
        // webhook 은 로그인 없이 열려 있다. 대신 서명을 검증한다.
        .route("/payments/webhook", post(payment::webhook))
        .route("/assets", get(asset::list).post(asset::create))
        // 등록과 재검수는 다른 일이라 경로도 다르다. 한때 둘이 같은 핸들러를
        // 가리켜서 재검수를 부르면 에셋이 하나 더 생겼다.
        .route("/assets/{id}/review", post(asset::review))
        .route("/assets/{id}/sales", post(sale::create))
        .route("/games", get(game::list))
        .route("/games/facets", get(game::facets))
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
