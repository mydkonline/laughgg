//! 다운로드.
//!
//! 에셋 id 를 그대로 받는 주소를 열지 않는다. 산 사람이 그 링크를 넘기면
//! 그걸로 끝이기 때문이다. 허가를 먼저 내고, 그 토큰으로만 받게 한다.

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde_json::json;

use super::{ApiResult, AppState, auth::CurrentAccount};
use crate::repo;

/// 허가를 낸다. 가진 사람만 받는다.
///
/// # Errors
/// 로그인이 없거나, 안 가졌거나, 파일이 아직 없으면 오류를 반환한다.
pub async fn grant(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Path(asset_id): Path<i64>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let grant = repo::grant_download(&st.pool, account.id, asset_id).await?;
    Ok((StatusCode::CREATED, Json(json!(grant))))
}

/* 허가를 쓴다.

토큰을 아는 사람이면 되므로 세션을 요구하지 않는다. 짧게 살고, 발급 시점에
소유를 확인했고, 쓸 때 한 번 더 확인한다 — 환불이나 계정 정리로 소유가
사라졌는데 발급해 둔 허가가 남아 있을 수 있다.

파일 자체는 여기서 안 흘려보낸다. 스토리지 주소를 돌려주고 받는 건
클라이언트가 직접 한다 — 수백 메가를 API 가 중계하면 그 요청 하나가
워커를 오래 잡는다. */
///
/// # Errors
/// 허가가 없거나 만료됐거나 소유가 사라졌으면 오류를 반환한다.
pub async fn redeem(
    State(st): State<AppState>,
    Path(token): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let file = repo::redeem_download(&st.pool, &token).await?;
    Ok(Json(json!(file)))
}
