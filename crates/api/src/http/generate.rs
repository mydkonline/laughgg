//! AI 에셋 생성.
//!
//! 요청은 큐에 넣고 바로 돌아온다. 생성이 30초에서 5분 걸려서 HTTP 요청
//! 안에서 기다릴 수 없다 — 그동안 워커를 붙잡고 있으면 동시 접속 몇십 명에
//! 서버가 멈춘다.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde_json::json;

use super::{ApiResult, AppState, auth::CurrentAccount};
use crate::{domain::GenRequest, repo};

/// 만들어 달라고 넣는다. 크레딧은 이 자리에서 깎인다.
///
/// # Errors
/// 로그인이 없거나, 요청이 규칙을 어겼거나, 크레딧이 모자라면 오류를 반환한다.
pub async fn create(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Json(req): Json<GenRequest>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let job = repo::enqueue(&st.pool, account.id, &req).await?;
    Ok((StatusCode::ACCEPTED, Json(json!(job))))
}

/// 어떻게 돼 가는지. 남의 작업은 못 본다.
///
/// # Errors
/// 작업이 없거나 남의 것이면 오류를 반환한다.
pub async fn get(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Path(id): Path<i64>,
) -> ApiResult<Json<serde_json::Value>> {
    let job = repo::get_job(&st.pool, account.id, id).await?;
    Ok(Json(json!(job)))
}

/// 내 작업 목록과 잔액.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
) -> ApiResult<Json<serde_json::Value>> {
    let jobs = repo::list_jobs(&st.pool, account.id).await?;
    let credits = repo::balance(&st.pool, account.id).await?;
    Ok(Json(json!({ "credits": credits, "jobs": jobs })))
}
