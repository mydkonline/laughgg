//! 에셋 등록, 검수, 목록, 상세.

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
    repo::{self, AssetQuery, NewAsset},
};

/// 목록 한 쪽. 전체 건수를 같이 준다 — 없으면 쪽 번호를 못 그린다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<AssetQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let page = repo::list_assets(&st.pool, &q).await?;
    Ok(Json(json!(page)))
}

/// 네 축의 선택지와 개수. 목록과 같은 조건을 받는다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn facets(
    State(st): State<AppState>,
    Query(q): Query<AssetQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let f = repo::asset_facets(&st.pool, &q).await?;
    Ok(Json(json!(f)))
}

/// 에셋 하나. 항목별 점수와 판매 수가 붙는다.
///
/// # Errors
/// 에셋이 없으면 오류를 반환한다.
pub async fn get(
    State(st): State<AppState>,
    Path(id): Path<i64>,
) -> ApiResult<Json<serde_json::Value>> {
    let detail = repo::get_asset(&st.pool, id).await?;
    Ok(Json(json!(detail)))
}

/// # Errors
/// 점수가 규칙을 어겼거나 쓰기에 실패하면 오류를 반환한다.
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
///
/// # Errors
/// 에셋이 없거나 점수가 규칙을 어기면 오류를 반환한다.
pub async fn review(
    State(st): State<AppState>,
    Path(id): Path<i64>,
    Json(input): Json<ReviewInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let result = repo::review_asset(&st.pool, id, input.scores).await?;
    Ok(Json(json!(result)))
}
