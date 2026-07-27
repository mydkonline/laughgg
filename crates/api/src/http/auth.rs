//! 가입, 로그인, 로그아웃, 내 정보.

use axum::{
    Json,
    extract::{FromRequestParts, State},
    http::{StatusCode, request::Parts},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde::Deserialize;
use serde_json::json;

use super::{ApiResult, AppState};
use crate::{
    domain::Credentials,
    repo::{self, Account, RepoError},
};

/// 세션 쿠키 이름.
pub const COOKIE: &str = "laughgg_session";

/* 쿠키를 어떻게 굽는가.

HttpOnly  자바스크립트가 못 읽는다. XSS 가 한 번 나도 세션은 안 샌다.
SameSite=Lax  다른 사이트가 띄운 폼으로 POST 가 날아가도 쿠키가 안 붙는다.
Secure  https 에서만 오간다. 로컬 개발은 http 라 그때만 끈다.
Path=/  API 와 페이지가 같은 쿠키를 본다. */
fn bake(token: String, secure: bool, max_age_days: i64) -> Cookie<'static> {
    Cookie::build((COOKIE, token))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(secure)
        .path("/")
        .max_age(time::Duration::days(max_age_days))
        .build()
}

/// 로그인한 계정. 핸들러 인자로 받으면 로그인이 강제된다.
///
/// 없으면 401 이 나가므로 핸들러 안에서 다시 확인할 일이 없다 — 확인을
/// 핸들러에 맡기면 언젠가 한 곳에서 빠뜨린다.
pub struct CurrentAccount(pub Account);

impl FromRequestParts<AppState> for CurrentAccount {
    type Rejection = super::ApiError;

    async fn from_request_parts(parts: &mut Parts, st: &AppState) -> Result<Self, Self::Rejection> {
        let jar = CookieJar::from_headers(&parts.headers);
        let token = jar
            .get(COOKIE)
            .map(|c| c.value().to_owned())
            .ok_or(RepoError::Unauthenticated)?;

        repo::account_for_token(&st.pool, &token)
            .await?
            .map(CurrentAccount)
            .ok_or_else(|| RepoError::Unauthenticated.into())
    }
}

#[derive(Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

/// # Errors
/// 입력이 규칙을 어겼거나 이메일이 이미 쓰이면 오류를 반환한다.
pub async fn sign_up(
    State(st): State<AppState>,
    jar: CookieJar,
    Json(creds): Json<Credentials>,
) -> ApiResult<(StatusCode, CookieJar, Json<serde_json::Value>)> {
    let account = repo::sign_up(&st.pool, &creds).await?;
    let token = repo::open_session(&st.pool, account.id).await?;
    Ok((
        StatusCode::CREATED,
        jar.add(bake(token, st.secure_cookies, 30)),
        Json(json!(account)),
    ))
}

/// # Errors
/// 이메일이나 비밀번호가 맞지 않으면 오류를 반환한다.
pub async fn log_in(
    State(st): State<AppState>,
    jar: CookieJar,
    Json(input): Json<LoginInput>,
) -> ApiResult<(CookieJar, Json<serde_json::Value>)> {
    let account = repo::log_in(&st.pool, &input.email, &input.password).await?;
    let token = repo::open_session(&st.pool, account.id).await?;
    Ok((
        jar.add(bake(token, st.secure_cookies, 30)),
        Json(json!(account)),
    ))
}

/// 로그아웃. 세션 행을 지우므로 그 쿠키는 그 자리에서 죽는다.
///
/// 쿠키가 없어도 성공한다 — 로그아웃은 멱등해야 하고, 이미 나간 사람에게
/// 오류를 돌려줄 이유가 없다.
/// # Errors
/// 세션 삭제에 실패하면 오류를 반환한다.
pub async fn log_out(
    State(st): State<AppState>,
    jar: CookieJar,
) -> ApiResult<(CookieJar, Json<serde_json::Value>)> {
    if let Some(c) = jar.get(COOKIE) {
        repo::close_session(&st.pool, c.value()).await?;
    }
    let mut gone = bake(String::new(), st.secure_cookies, 0);
    gone.make_removal();
    Ok((jar.add(gone), Json(json!({ "ok": true }))))
}

pub async fn me(CurrentAccount(account): CurrentAccount) -> Json<serde_json::Value> {
    Json(json!(account))
}
