//! HTTP 경계 — 라우팅과 직렬화.
//!
//! 여기서만 상태 코드와 JSON 모양을 정한다. 판정은 [`crate::domain`] 이,
//! 질의는 [`crate::repo`] 가 한다. 핸들러가 SQL 을 직접 쓰기 시작하면
//! 그 순간 세 계층이 하나로 붙는다.

mod asset;
pub mod auth;
mod download;
mod error;
mod game;
mod metrics;
pub mod oauth;
pub mod payment;
mod post;
mod sale;
pub mod upload;

use axum::{
    Router,
    extract::State,
    http::{HeaderValue, Method, StatusCode},
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
    pub google: Option<crate::http::oauth::google::GoogleConfig>,
    pub stripe: Option<crate::http::payment::StripeConfig>,
    pub storage: Option<crate::http::upload::StorageConfig>,
    /// 쿠키를 실어 보낼 수 있는 오리진. 비면 CORS 를 안 연다.
    pub cors_origins: Vec<String>,
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
            storage: None,
            cors_origins: Vec::new(),
        }
    }
}

/* CORS.

permissive 로는 쿠키가 안 실린다. 브라우저가 credentials 를 붙이려면
서버가 정확한 오리진을 되돌려 줘야 하고, 와일드카드는 그 자리에서 거절된다 —
아무 사이트나 남의 세션으로 우리 API 를 부를 수 있게 되기 때문이다.

허용 목록이 비어 있으면 CORS 를 안 연다. 프런트와 API 가 같은 도메인이면
애초에 필요 없고, 필요 없는데 열어 두면 그게 구멍이다. */
fn cors(origins: &[String]) -> CorsLayer {
    if origins.is_empty() {
        return CorsLayer::new();
    }
    let allowed: Vec<HeaderValue> = origins.iter().filter_map(|o| o.parse().ok()).collect();

    CorsLayer::new()
        .allow_origin(allowed)
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([axum::http::header::CONTENT_TYPE])
}

/// API 라우터와 정적 파일 서빙을 조립한다.
pub fn router(state: AppState) -> Router {
    let origins = state.cors_origins.clone();
    let api = Router::new()
        .route("/health", get(health))
        .route("/auth/signup", post(auth::sign_up))
        .route("/auth/login", post(auth::log_in))
        .route("/auth/logout", post(auth::log_out))
        .route("/auth/me", get(auth::me))
        .route("/auth/google", get(oauth::google::start))
        .route("/auth/google/callback", get(oauth::google::callback))
        // 결제창은 Stripe 가 띄운다. 여기로는 카드 정보가 오지 않는다.
        .route("/assets/{id}/checkout", post(payment::checkout))
        // 허가를 먼저 내고 그 토큰으로만 받는다. 에셋 id 로 바로 받게 하면
        // 산 사람이 링크를 넘기는 순간 아무나 받는다.
        .route("/assets/{id}/download", post(download::grant))
        .route("/downloads/{token}", get(download::redeem))
        .route("/orders", get(payment::my_orders))
        .route("/me/library", get(payment::my_library))
        // webhook 은 로그인 없이 열려 있다. 대신 서명을 검증한다.
        .route("/payments/webhook", post(payment::webhook))
        .route("/assets", get(asset::list).post(asset::create))
        .route("/assets/facets", get(asset::facets))
        // 파일은 서버를 안 지나간다. 어디에 올릴지만 정해 준다.
        .route("/uploads", post(upload::intent))
        .route("/assets/{id}", get(asset::get))
        // 등록과 재검수는 다른 일이라 경로도 다르다. 한때 둘이 같은 핸들러를
        // 가리켜서 재검수를 부르면 에셋이 하나 더 생겼다.
        .route("/assets/{id}/review", post(asset::review))
        .route("/assets/{id}/sales", post(sale::create))
        .route("/games", get(game::list))
        .route("/games/facets", get(game::facets))
        .route("/metrics", get(metrics::get))
        .route("/posts", get(post::list).post(post::create))
        .route("/posts/{slug}", get(post::get).delete(post::remove))
        .with_state(state);

    Router::new()
        .nest("/api", api)
        .fallback_service(ServeDir::new("web").append_index_html_on_directories(true))
        .layer(cors(&origins))
        .layer(TraceLayer::new_for_http())
}

/* 헬스체크.

문자열만 돌려주면 프로세스가 살아 있다는 말밖에 안 된다. DB 가 죽어도
ok 가 나가고, 그걸 보고 로드밸런서는 계속 트래픽을 보낸다.
실제로 한 번 물어본다. */
async fn health(State(st): State<AppState>) -> (StatusCode, axum::Json<serde_json::Value>) {
    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&st.pool)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            axum::Json(serde_json::json!({
                "status": "ok",
                "service": "laughgg-api",
                "database": "up",
                "google": st.google.is_some(),
                "payments": st.stripe.is_some(),
            })),
        ),
        Err(e) => {
            tracing::error!(error = ?e, "health check could not reach the database");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                axum::Json(serde_json::json!({
                    "status": "degraded",
                    "service": "laughgg-api",
                    "database": "down",
                })),
            )
        }
    }
}
