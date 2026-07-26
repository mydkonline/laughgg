//! 게임별 엔진 조회와 패싯.

use axum::{
    Json,
    extract::{Query, State},
};
use serde_json::json;

use super::{ApiResult, AppState};
use crate::repo::{self, GameQuery};

/// 목록 한 쪽. 전체 건수를 같이 준다 — 없으면 쪽 번호를 못 그린다.
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let page = repo::list_games(&st.pool, &q).await?;
    Ok(Json(json!(page)))
}

/// 네 축의 선택지와 개수. 목록과 같은 조건을 받는다.
pub async fn facets(
    State(st): State<AppState>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let f = repo::game_facets(&st.pool, &q).await?;
    Ok(Json(json!(f)))
}
