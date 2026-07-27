//! 구글 로그인.
//!
//! 인가 코드 흐름이다. 브라우저를 구글로 보내고, 구글이 코드를 들고 돌아오면
//! 서버가 그 코드를 토큰으로 바꾼다. 토큰 교환은 서버끼리만 하므로 클라이언트
//! 시크릿이 브라우저에 안 나간다.
//!
//! 자격증명이 없으면 라우트가 503 을 낸다. 없는 채로 뜨다가 사용자가 눌렀을 때
//! 500 이 나면 무엇이 빠졌는지 알 수가 없다.

use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect, Response},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde::Deserialize;
use sha2::{Digest as _, Sha256};

use super::{ApiError, AppState, auth};
use crate::repo::{self, RepoError};

/// 로그인 뒤 돌아갈 곳과 구글 자격증명.
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

/// state 를 담아 두는 쿠키. CSRF 를 막는 유일한 장치라 짧게 산다.
const STATE_COOKIE: &str = "laughgg_oauth_state";

fn config(st: &AppState) -> Result<&GoogleConfig, ApiError> {
    st.google
        .as_ref()
        .ok_or_else(|| ApiError::unavailable("google sign-in is not configured on this server"))
}

/* 구글로 보낸다.

state 를 난수로 만들어 쿠키와 URL 양쪽에 넣는다. 돌아왔을 때 둘이 같아야
우리가 시작한 로그인이다. 이게 없으면 공격자가 자기 계정으로 로그인시키는
요청을 남의 브라우저에서 완성시킬 수 있다.

쿠키에는 해시를 넣는다. 쿠키가 새도 그것만으로 유효한 state 를 못 만든다. */
/// # Errors
/// 구글 자격증명이 없거나 난수를 못 얻으면 오류를 반환한다.
pub async fn start(State(st): State<AppState>, jar: CookieJar) -> Result<Response, ApiError> {
    let cfg = config(&st)?;
    let state = repo::new_state_token()?;

    let url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={}&redirect_uri={}&response_type=code\
         &scope={}&state={}&access_type=online&prompt=select_account",
        urlencoding::encode(&cfg.client_id),
        urlencoding::encode(&cfg.redirect_uri),
        urlencoding::encode("openid email profile"),
        urlencoding::encode(&state),
    );

    let cookie = Cookie::build((STATE_COOKIE, hex::encode(Sha256::digest(state.as_bytes()))))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(st.secure_cookies)
        .path("/")
        .max_age(time::Duration::minutes(10))
        .build();

    Ok((jar.add(cookie), Redirect::to(&url)).into_response())
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

/* 구글이 코드를 들고 돌아왔다.

확인 순서가 중요하다 — state 를 먼저 본다. 코드부터 교환하면 남이 시킨
로그인이어도 이미 구글에 요청이 나간 뒤다. */
/// # Errors
/// state 가 안 맞거나 구글 응답이 이상하면 오류를 반환한다.
pub async fn callback(
    State(st): State<AppState>,
    jar: CookieJar,
    Query(q): Query<Callback>,
) -> Result<Response, ApiError> {
    let cfg = config(&st)?;

    if let Some(err) = q.error {
        return Err(ApiError::bad_request(format!(
            "google sign-in canceled: {err}"
        )));
    }

    let expected = jar
        .get(STATE_COOKIE)
        .map(|c| c.value().to_owned())
        .ok_or_else(|| ApiError::bad_request("missing sign-in state; start over"))?;
    let state = q
        .state
        .ok_or_else(|| ApiError::bad_request("missing state parameter"))?;
    if hex::encode(Sha256::digest(state.as_bytes())) != expected {
        return Err(ApiError::bad_request(
            "sign-in state did not match; start over",
        ));
    }

    let code = q
        .code
        .ok_or_else(|| ApiError::bad_request("missing authorization code"))?;

    let http = reqwest::Client::new();
    let token: TokenResponse = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", cfg.client_id.as_str()),
            ("client_secret", cfg.client_secret.as_str()),
            ("redirect_uri", cfg.redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| {
            ApiError::from(RepoError::Other(anyhow::anyhow!(
                "google token request: {e}"
            )))
        })?
        .error_for_status()
        .map_err(|e| {
            ApiError::from(RepoError::Other(anyhow::anyhow!(
                "google rejected the code: {e}"
            )))
        })?
        .json()
        .await
        .map_err(|e| ApiError::from(RepoError::Other(anyhow::anyhow!("google token body: {e}"))))?;

    let info: UserInfo = http
        .get("https://openidconnect.googleapis.com/v1/userinfo")
        .bearer_auth(&token.access_token)
        .send()
        .await
        .map_err(|e| ApiError::from(RepoError::Other(anyhow::anyhow!("google userinfo: {e}"))))?
        .error_for_status()
        .map_err(|e| {
            ApiError::from(RepoError::Other(anyhow::anyhow!(
                "google userinfo status: {e}"
            )))
        })?
        .json()
        .await
        .map_err(|e| {
            ApiError::from(RepoError::Other(anyhow::anyhow!(
                "google userinfo body: {e}"
            )))
        })?;

    // 확인 안 된 이메일로 계정을 붙이면 남의 계정을 가져갈 수 있다.
    // 구글에 아무 도메인이나 등록해 두고 그 주소로 가입하면 되기 때문이다.
    if !info.email_verified {
        return Err(ApiError::bad_request(
            "google account email is not verified",
        ));
    }

    let name = info
        .name
        .unwrap_or_else(|| info.email.split('@').next().unwrap_or("user").to_owned());
    let account = repo::upsert_external(&st.pool, "google", &info.sub, &info.email, &name).await?;
    let session = repo::open_session(&st.pool, account.id).await?;

    let mut state_gone = Cookie::from(STATE_COOKIE);
    state_gone.set_path("/");
    state_gone.make_removal();

    let session_cookie = Cookie::build((auth::COOKIE, session))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(st.secure_cookies)
        .path("/")
        .max_age(time::Duration::days(30))
        .build();

    Ok((
        jar.add(state_gone).add(session_cookie),
        Redirect::to(&cfg.success_uri),
    )
        .into_response())
}
