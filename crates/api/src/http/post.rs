//! 커뮤니티 글.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde_json::json;

use super::{ApiResult, AppState, auth::CurrentAccount};
use crate::repo::{self, NewPost, PostQuery};

/// 글 목록. 종류를 안 주면 넷을 섞어서 준다.
///
/// # Errors
/// 종류가 없는 값이거나 조회에 실패하면 오류를 반환한다.
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<PostQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let page = repo::list_posts(&st.pool, &q).await?;
    Ok(Json(json!(page)))
}

/// 글 하나. 주소에 쓰는 건 id 가 아니라 slug 다.
///
/// # Errors
/// 글이 없으면 오류를 반환한다.
pub async fn get(
    State(st): State<AppState>,
    Path(slug): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let post = repo::get_post(&st.pool, &slug).await?;
    Ok(Json(json!(post)))
}

/// 글을 쓴다. 로그인한 사람이 글쓴이다.
///
/// # Errors
/// 로그인이 없거나 입력이 규칙을 어기면 오류를 반환한다.
pub async fn create(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Json(input): Json<NewPost>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let post = repo::create_post(&st.pool, account.id, &input).await?;
    Ok((StatusCode::CREATED, Json(json!(post))))
}

/// 내 글을 지운다.
///
/// # Errors
/// 글이 없거나 내 것이 아니면 오류를 반환한다.
pub async fn remove(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Path(slug): Path<String>,
) -> ApiResult<StatusCode> {
    repo::delete_post(&st.pool, account.id, &slug).await?;
    Ok(StatusCode::NO_CONTENT)
}
