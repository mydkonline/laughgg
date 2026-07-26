//! 대시보드 집계.

use axum::{Json, extract::State};
use serde_json::json;

use super::{ApiResult, AppState};
use crate::repo;

pub async fn get(State(st): State<AppState>) -> ApiResult<Json<serde_json::Value>> {
    let m = repo::metrics(&st.pool).await?;
    Ok(Json(json!(m)))
}
