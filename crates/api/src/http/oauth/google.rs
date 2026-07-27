//! 구글 로그인.
//!
//! 인가 코드 흐름이다. 브라우저를 구글로 보내고, 구글이 코드를 들고 돌아오면
//! 서버가 그 코드를 토큰으로 바꾼다. 토큰 교환은 서버끼리만 하므로 클라이언트
//! 시크릿이 브라우저에 안 나간다.
//!
//! 흐름의 공통 부분은 [`super`] 에 있다. 여기 있는 건 구글에만 해당하는
//! 것들이다 — 엔드포인트 주소, 요구하는 스코프, 사용자 정보 모양.

use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect, Response},
};
use axum_extra::extract::cookie::CookieJar;
use serde::Deserialize;

use super::{check_state, clear_state, finish, require, state_cookie};
use crate::{
    http::{ApiError, AppState},
    repo::{self, RepoError},
};

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://openidconnect.googleapis.com/v1/userinfo";

/// 구글 자격증명과 로그인 뒤 돌아갈 곳.
#[derive(Clone)]
pub struct GoogleConfig {
    pub client_id: String,
    pub client_secret: String,
    /// 구글 콘솔에 등록한 것과 글자 하나까지 같아야 한다.
    pub redirect_uri: String,
    /// 로그인이 끝나면 브라우저를 여기로 보낸다.
    pub success_uri: String,
}

impl GoogleConfig {
    /// 환경변수에서 읽는다. 하나라도 없으면 구글 로그인을 끈다.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Some(Self {
            client_id: std::env::var("GOOGLE_CLIENT_ID").ok()?,
            client_secret: std::env::var("GOOGLE_CLIENT_SECRET").ok()?,
            redirect_uri: std::env::var("GOOGLE_REDIRECT_URI").ok()?,
            success_uri: std::env::var("GOOGLE_SUCCESS_URI").unwrap_or_else(|_| "/".to_owned()),
        })
    }
}

/// 구글로 보낸다.
///
/// # Errors
/// 자격증명이 없거나 난수를 못 얻으면 오류를 반환한다.
pub async fn start(State(st): State<AppState>, jar: CookieJar) -> Result<Response, ApiError> {
    let cfg = require(st.google.as_ref(), "google sign-in")?;
    let state = repo::new_state_token()?;

    let url = format!(
        "{AUTH_URL}?client_id={}&redirect_uri={}&response_type=code\
         &scope={}&state={}&access_type=online&prompt=select_account",
        urlencoding::encode(&cfg.client_id),
        urlencoding::encode(&cfg.redirect_uri),
        urlencoding::encode("openid email profile"),
        urlencoding::encode(&state),
    );

    Ok((
        jar.add(state_cookie(&state, st.secure_cookies)),
        Redirect::to(&url),
    )
        .into_response())
}

#[derive(Deserialize)]
pub struct Callback {
    pub code: Option<String>,
    pub state: Option<String>,
    /// 사용자가 취소하면 구글이 이걸 준다.
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct UserInfo {
    sub: String,
    email: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    email_verified: bool,
}

/// 구글이 코드를 들고 돌아왔다.
///
/// # Errors
/// state 가 안 맞거나 구글 응답이 이상하면 오류를 반환한다.
pub async fn callback(
    State(st): State<AppState>,
    jar: CookieJar,
    Query(q): Query<Callback>,
) -> Result<Response, ApiError> {
    let cfg = require(st.google.as_ref(), "google sign-in")?;

    if let Some(err) = q.error {
        return Err(ApiError::bad_request(format!(
            "google sign-in canceled: {err}"
        )));
    }

    // state 를 먼저 본다. 코드부터 교환하면 남이 시킨 로그인이어도
    // 이미 구글에 요청이 나간 뒤다.
    check_state(&jar, q.state.as_deref())?;
    let code = q
        .code
        .ok_or_else(|| ApiError::bad_request("missing authorization code"))?;

    let http = reqwest::Client::new();
    let token: TokenResponse = http
        .post(TOKEN_URL)
        .form(&[
            ("code", code.as_str()),
            ("client_id", cfg.client_id.as_str()),
            ("client_secret", cfg.client_secret.as_str()),
            ("redirect_uri", cfg.redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| upstream("google token request", &e))?
        .error_for_status()
        .map_err(|e| upstream("google rejected the code", &e))?
        .json()
        .await
        .map_err(|e| upstream("google token body", &e))?;

    let info: UserInfo = http
        .get(USERINFO_URL)
        .bearer_auth(&token.access_token)
        .send()
        .await
        .map_err(|e| upstream("google userinfo", &e))?
        .error_for_status()
        .map_err(|e| upstream("google userinfo status", &e))?
        .json()
        .await
        .map_err(|e| upstream("google userinfo body", &e))?;

    /* 확인 안 된 이메일로 계정을 붙이면 남의 계정을 가져갈 수 있다.
    구글에 아무 도메인이나 등록해 두고 그 주소로 가입하면 되기 때문이다. */
    if !info.email_verified {
        return Err(ApiError::bad_request(
            "google account email is not verified",
        ));
    }

    let name = info
        .name
        .unwrap_or_else(|| info.email.split('@').next().unwrap_or("user").to_owned());
    let session = finish(&st, "google", &info.sub, &info.email, &name).await?;

    Ok((
        jar.add(clear_state()).add(session),
        Redirect::to(&cfg.success_uri),
    )
        .into_response())
}

/// 구글이 문제였는지 우리가 문제였는지 로그에서 구분되게 남긴다.
fn upstream(what: &str, err: &reqwest::Error) -> ApiError {
    RepoError::Other(anyhow::anyhow!("{what}: {err}")).into()
}
