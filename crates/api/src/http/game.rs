//! 게임별 엔진 조회.

use axum::{
    Json,
    extract::{Query, State},
};
use serde::Deserialize;
use serde_json::json;

use super::{ApiResult, AppState};
use crate::repo;

#[derive(Deserialize)]
pub struct GameQuery {
    pub platform: Option<String>,
}

pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<GameQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let rows = repo::list_games(&st.pool, q.platform.as_deref()).await?;
    Ok(Json(json!({ "count": rows.len(), "games": rows })))
}
