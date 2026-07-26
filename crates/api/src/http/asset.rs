//! 에셋 등록, 검수, 목록.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::json;

use super::{ApiResult, AppState};
use crate::{
    domain::ReviewScores,
    repo,
    repo::{AssetQuery, NewAsset},
};

pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<AssetQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let rows = repo::list_assets(&st.pool, &q).await?;
    Ok(Json(json!({ "count": rows.len(), "assets": rows })))
}

pub async fn create(
    State(st): State<AppState>,
    Json(input): Json<NewAsset>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let result = repo::create_asset(&st.pool, &input).await?;
    Ok((StatusCode::CREATED, Json(json!(result))))
}

#[derive(Deserialize)]
pub struct ReviewInput {
    pub scores: ReviewScores,
}

/// 이미 등록된 에셋을 다시 채점한다. 새 에셋을 만들지 않는다.
pub async fn review(
    State(st): State<AppState>,
    Path(id): Path<i64>,
    Json(input): Json<ReviewInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let result = repo::review_asset(&st.pool, id, input.scores).await?;
    Ok(Json(json!(result)))
}
