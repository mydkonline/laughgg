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
        let status = match &err {
            RepoError::AssetNotFound(_) | RepoError::StudioNotFound(_) => StatusCode::NOT_FOUND,
            RepoError::Score(_) => StatusCode::BAD_REQUEST,
            // 요청은 멀쩡하고 대상의 상태가 안 맞는 경우다. 400 으로 내면
            // 클라이언트가 자기 입력을 고치려 든다.
            RepoError::AssetNotReviewed(_) | RepoError::AssetNotSellable { .. } => {
                StatusCode::CONFLICT
            }
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

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
