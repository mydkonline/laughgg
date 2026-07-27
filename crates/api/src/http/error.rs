//! HTTP 경계에서의 오류.
//!
//! 전부 500 으로 내보내면 클라이언트가 "내 요청이 틀렸나, 서버가 죽었나" 를
//! 구분할 수 없다. 없는 자원은 404, 규칙을 어긴 입력은 400, 나머지만 500 이다.
//! 내부 사정은 언제나 로그로만 남긴다.

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::repo::RepoError;

pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl From<RepoError> for ApiError {
    fn from(err: RepoError) -> Self {
        /* 상태 코드별로 묶는다.

        404  없는 것. 허가는 없는 것과 만료된 것을 구분하지 않는다 —
             구분해 주면 토큰을 찍어 볼 수 있다.
        400  입력이 틀렸다. 고쳐서 다시 보내면 된다.
        409  입력은 멀쩡하고 대상의 상태가 안 맞는다. 400 으로 내면
             클라이언트가 자기 입력을 고치려 든다.
        500  우리 잘못. 이것만 사고다. */
        let status = match &err {
            RepoError::AssetNotFound(_)
            | RepoError::StudioNotFound(_)
            | RepoError::GrantNotFound
            | RepoError::PostNotFound(_)
            | RepoError::JobNotFound(_) => StatusCode::NOT_FOUND,

            /* 크레딧 부족은 입력이 틀린 게 아니다. 400 으로 내면 화면이
            프롬프트를 고치라고 안내하는데, 고쳐도 안 된다. */
            RepoError::Gen(crate::domain::GenError::NotEnoughCredits { .. }) => {
                StatusCode::PAYMENT_REQUIRED
            }

            RepoError::Score(_)
            | RepoError::Credential(_)
            | RepoError::File(_)
            | RepoError::Post(_)
            | RepoError::Gen(_) => StatusCode::BAD_REQUEST,

            RepoError::BadCredentials | RepoError::Unauthenticated => StatusCode::UNAUTHORIZED,
            RepoError::Forbidden => StatusCode::FORBIDDEN,

            RepoError::NoFile(_)
            | RepoError::EmailTaken(_)
            | RepoError::AssetNotReviewed(_)
            | RepoError::AssetNotSellable { .. } => StatusCode::CONFLICT,

            RepoError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        // 500 만 사고다. 400 과 404 는 정상적인 거절이라 error 로 남기지 않는다.
        if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!(error = ?err, "request failed");
        } else {
            tracing::debug!(error = ?err, %status, "request rejected");
        }
        Self {
            status,
            message: err.to_string(),
        }
    }
}

impl ApiError {
    fn of(status: StatusCode, message: impl Into<String>) -> Self {
        let message = message.into();
        if status.is_server_error() {
            tracing::error!(%status, %message, "request failed");
        }
        Self { status, message }
    }

    /// 입력이 틀렸다.
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::of(StatusCode::BAD_REQUEST, message)
    }

    /// 서버가 이 기능을 켜 두지 않았다. 자격증명이 안 들어온 경우다.
    ///
    /// 500 으로 내면 고장으로 읽히고, 404 로 내면 경로를 잘못 쓴 줄 안다.
    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::of(StatusCode::SERVICE_UNAVAILABLE, message)
    }

    /// 우리가 부른 바깥 서비스가 문제였다. 우리 잘못과 구분해 둔다.
    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self::of(StatusCode::BAD_GATEWAY, message)
    }

    /// 우리 잘못이다.
    pub fn internal(message: impl Into<String>) -> Self {
        Self::of(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
