//! 소셜 로그인.
//!
//! 제공자마다 파일을 나눈다. 지금은 구글 하나지만 애플·디스코드·스팀이 붙으면
//! 각자 토큰 엔드포인트와 사용자 정보 모양이 다르다 — 한 파일에 모으면
//! 분기가 쌓이고, 하나를 고치다 다른 하나가 깨진다.
//!
//! 공통은 여기 둔다. 흐름은 어느 제공자나 같다.
//!   1. state 를 만들어 쿠키와 URL 양쪽에 넣고 제공자로 보낸다
//!   2. 돌아오면 state 를 대조한다 — 우리가 시작한 로그인인지 확인하는 유일한 장치
//!   3. 코드를 토큰으로 바꾸고 사용자 정보를 읽는다
//!   4. 이메일로 계정을 찾거나 만들고 세션을 연다

pub mod google;

use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use sha2::{Digest as _, Sha256};

use super::{ApiError, AppState, auth};

/// state 를 담아 두는 쿠키. CSRF 를 막는 유일한 장치라 짧게 산다.
const STATE_COOKIE: &str = "laughgg_oauth_state";

/// state 쿠키를 굽는다. 원문이 아니라 해시를 넣는다 — 쿠키가 새도
/// 그것만으로 유효한 state 를 만들지 못한다.
fn state_cookie(state: &str, secure: bool) -> Cookie<'static> {
    Cookie::build((STATE_COOKIE, hex::encode(Sha256::digest(state.as_bytes()))))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(secure)
        .path("/")
        .max_age(time::Duration::minutes(10))
        .build()
}

/* 돌아온 state 가 우리가 보낸 것인가.

이게 없으면 공격자가 자기 계정으로 로그인시키는 요청을 남의 브라우저에서
완성시킬 수 있다. 코드를 교환하기 전에 먼저 본다 — 교환부터 하면 남이
시킨 로그인이어도 이미 제공자에 요청이 나간 뒤다. */
fn check_state(jar: &CookieJar, returned: Option<&str>) -> Result<(), ApiError> {
    let expected = jar
        .get(STATE_COOKIE)
        .map(|c| c.value().to_owned())
        .ok_or_else(|| ApiError::bad_request("missing sign-in state; start over"))?;
    let state = returned.ok_or_else(|| ApiError::bad_request("missing state parameter"))?;

    if hex::encode(Sha256::digest(state.as_bytes())) == expected {
        Ok(())
    } else {
        Err(ApiError::bad_request(
            "sign-in state did not match; start over",
        ))
    }
}

/// 다 쓴 state 쿠키를 지운다. 남겨 두면 다음 로그인이 옛 값과 대조된다.
fn clear_state() -> Cookie<'static> {
    let mut gone = Cookie::from(STATE_COOKIE);
    gone.set_path("/");
    gone.make_removal();
    gone
}

/// 로그인이 끝났다. 세션 쿠키를 굽는다.
fn session_cookie(token: String, secure: bool) -> Cookie<'static> {
    Cookie::build((auth::COOKIE, token))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(secure)
        .path("/")
        .max_age(time::Duration::days(30))
        .build()
}

/// 제공자 설정이 없으면 그 경로는 503 이다.
fn require<'a, T>(cfg: Option<&'a T>, what: &str) -> Result<&'a T, ApiError> {
    cfg.ok_or_else(|| ApiError::unavailable(format!("{what} is not configured on this server")))
}

/// 어느 제공자나 같은 마무리 — 계정을 찾거나 만들고 세션을 연다.
async fn finish(
    st: &AppState,
    provider: &str,
    subject: &str,
    email: &str,
    display_name: &str,
) -> Result<Cookie<'static>, ApiError> {
    let account =
        crate::repo::upsert_external(&st.pool, provider, subject, email, display_name).await?;
    let session = crate::repo::open_session(&st.pool, account.id).await?;
    Ok(session_cookie(session, st.secure_cookies))
}
