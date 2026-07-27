//! 판매 기록.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde_json::json;

use super::{ApiResult, AppState};
use crate::repo::{self, NewSale};

/// 에셋 한 건을 판다. 가격은 에셋에서 읽고 수수료율은 서버가 정한다.
pub async fn create(
    State(st): State<AppState>,
    Path(id): Path<i64>,
    body: Option<Json<NewSale>>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let input = body.map(|Json(b)| b).unwrap_or_default();
    let result = repo::record_sale(&st.pool, id, &input).await?;
    Ok((StatusCode::CREATED, Json(json!(result))))
}
