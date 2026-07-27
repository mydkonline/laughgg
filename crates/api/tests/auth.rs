//! 인증 통합 테스트.
//!
//! 여기서 보는 건 셋이다. 세션이 실제로 붙는가, 남의 것을 못 보는가,
//! 그리고 실패했을 때 정보가 새지 않는가.

use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt as _;
use laughgg_api::{
    http::{AppState, router},
    repo,
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt as _;

struct Res {
    status: StatusCode,
    body: Value,
    /// 응답이 심어 준 세션 쿠키. 다음 요청에 그대로 실어 보낸다.
    cookie: Option<String>,
}

async fn call(
    pool: &PgPool,
    method: &str,
    uri: &str,
    body: Option<Value>,
    cookie: Option<&str>,
) -> Res {
    let mut req = Request::builder().method(method).uri(uri);
    if let Some(c) = cookie {
        req = req.header(header::COOKIE, c);
    }
    let req = match body {
        Some(b) => req
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(b.to_string())),
        None => req.body(Body::empty()),
    }
    .expect("요청");

    let res = router(AppState::bare(pool.clone()))
        .oneshot(req)
        .await
        .expect("라우터");
    let status = res.status();
    let set = res
        .headers()
        .get_all(header::SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .find(|v| v.starts_with("laughgg_session="))
        .map(|v| v.split(';').next().unwrap_or(v).to_owned());
    let bytes = res.into_body().collect().await.expect("본문").to_bytes();
    Res {
        status,
        body: serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        cookie: set,
    }
}

fn signup_body(email: &str, password: &str) -> Value {
    json!({ "email": email, "password": password })
}

#[sqlx::test]
async fn signing_up_opens_a_session(pool: PgPool) {
    let r = call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("sh@op.gg", "goodpassword")),
        None,
    )
    .await;

    assert_eq!(r.status, StatusCode::CREATED);
    assert_eq!(r.body["email"], "sh@op.gg");
    assert_eq!(r.body["display_name"], "sh", "이름을 안 주면 이메일 앞부분");
    assert_eq!(r.body["has_password"], true);
    let cookie = r.cookie.expect("세션 쿠키가 붙어야 한다");

    let me = call(&pool, "GET", "/api/auth/me", None, Some(&cookie)).await;
    assert_eq!(me.status, StatusCode::OK);
    assert_eq!(me.body["email"], "sh@op.gg");
}

/// 비밀번호 원문이 응답이나 DB 어디에도 없어야 한다.
#[sqlx::test]
async fn the_password_never_appears_anywhere(pool: PgPool) {
    let r = call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("sh@op.gg", "goodpassword")),
        None,
    )
    .await;
    assert!(
        !r.body.to_string().contains("goodpassword"),
        "응답에 비밀번호가 들어 있다: {}",
        r.body
    );

    let stored: String = sqlx::query_scalar("SELECT password_hash FROM accounts WHERE email = $1")
        .bind("sh@op.gg")
        .fetch_one(&pool)
        .await
        .expect("해시");
    assert!(!stored.contains("goodpassword"), "평문이 저장됐다");
    assert!(
        stored.starts_with("$argon2id$"),
        "Argon2id 여야 한다: {stored}"
    );
}

#[sqlx::test]
async fn a_taken_email_is_409(pool: PgPool) {
    let body = signup_body("sh@op.gg", "goodpassword");
    let first = call(&pool, "POST", "/api/auth/signup", Some(body.clone()), None).await;
    assert_eq!(first.status, StatusCode::CREATED);

    // 대소문자만 다른 주소도 같은 사람이다.
    let again = call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("SH@OP.GG", "otherpassword")),
        None,
    )
    .await;
    assert_eq!(again.status, StatusCode::CONFLICT);
}

/* 실패 응답이 어느 쪽이 틀렸는지 알려 주면 안 된다.

"없는 계정" 과 "비밀번호 틀림" 을 구분해 주면 그게 곧 가입자 명단이 된다. */
#[sqlx::test]
async fn login_failures_do_not_say_which_half_was_wrong(pool: PgPool) {
    call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("sh@op.gg", "goodpassword")),
        None,
    )
    .await;

    let no_such = call(
        &pool,
        "POST",
        "/api/auth/login",
        Some(signup_body("nobody@op.gg", "goodpassword")),
        None,
    )
    .await;
    let wrong_pw = call(
        &pool,
        "POST",
        "/api/auth/login",
        Some(signup_body("sh@op.gg", "wrongpassword")),
        None,
    )
    .await;

    assert_eq!(no_such.status, StatusCode::UNAUTHORIZED);
    assert_eq!(wrong_pw.status, StatusCode::UNAUTHORIZED);
    assert_eq!(
        no_such.body, wrong_pw.body,
        "두 경우의 응답이 다르면 계정 존재 여부가 샌다"
    );
}

#[sqlx::test]
async fn logging_out_kills_the_session_immediately(pool: PgPool) {
    let r = call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("sh@op.gg", "goodpassword")),
        None,
    )
    .await;
    let cookie = r.cookie.expect("쿠키");

    let out = call(&pool, "POST", "/api/auth/logout", None, Some(&cookie)).await;
    assert_eq!(out.status, StatusCode::OK);

    // 같은 쿠키를 다시 써도 안 통해야 한다. 서버가 행을 지웠기 때문이다.
    let me = call(&pool, "GET", "/api/auth/me", None, Some(&cookie)).await;
    assert_eq!(me.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn logging_out_without_a_session_is_fine(pool: PgPool) {
    // 멱등해야 한다. 이미 나간 사람에게 오류를 돌려줄 이유가 없다.
    let out = call(&pool, "POST", "/api/auth/logout", None, None).await;
    assert_eq!(out.status, StatusCode::OK);
}

#[sqlx::test]
async fn me_needs_a_session(pool: PgPool) {
    let anon = call(&pool, "GET", "/api/auth/me", None, None).await;
    assert_eq!(anon.status, StatusCode::UNAUTHORIZED);

    let forged = call(
        &pool,
        "GET",
        "/api/auth/me",
        None,
        Some("laughgg_session=deadbeef"),
    )
    .await;
    assert_eq!(
        forged.status,
        StatusCode::UNAUTHORIZED,
        "아무 값이나 통하면 안 된다"
    );
}

#[sqlx::test]
async fn short_passwords_are_rejected(pool: PgPool) {
    let r = call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("sh@op.gg", "short")),
        None,
    )
    .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
}

/* 세션 토큰 원문은 DB 에 없어야 한다. */
#[sqlx::test]
async fn only_the_hash_of_the_session_token_is_stored(pool: PgPool) {
    let r = call(
        &pool,
        "POST",
        "/api/auth/signup",
        Some(signup_body("sh@op.gg", "goodpassword")),
        None,
    )
    .await;
    let cookie = r.cookie.expect("쿠키");
    let token = cookie.trim_start_matches("laughgg_session=");

    let hit: Option<String> =
        sqlx::query_scalar("SELECT token_hash FROM sessions WHERE token_hash = $1")
            .bind(token)
            .fetch_optional(&pool)
            .await
            .expect("조회");
    assert!(hit.is_none(), "토큰 원문이 그대로 저장돼 있다");

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions")
        .fetch_one(&pool)
        .await
        .expect("개수");
    assert_eq!(count, 1, "세션은 하나 있어야 한다");
}

/* 구글로 들어온 사람과 비밀번호로 가입한 사람이 같은 이메일이면 같은 계정이다. */
#[sqlx::test]
async fn google_and_password_logins_land_on_the_same_account(pool: PgPool) {
    let signed = repo::sign_up(
        &pool,
        &laughgg_api::domain::Credentials {
            email: "sh@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("가입");

    let via_google = repo::upsert_external(&pool, "google", "google-123", "sh@op.gg", "SH")
        .await
        .expect("구글 로그인");

    assert_eq!(via_google.id, signed.id, "계정이 갈리면 안 된다");
    assert!(
        via_google.has_password,
        "원래 걸어 둔 비밀번호가 살아 있어야 한다"
    );

    // 두 번째 구글 로그인도 같은 계정이어야 한다.
    let again = repo::upsert_external(&pool, "google", "google-123", "sh@op.gg", "SH")
        .await
        .expect("재로그인");
    assert_eq!(again.id, signed.id);

    let accounts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM accounts")
        .fetch_one(&pool)
        .await
        .expect("개수");
    assert_eq!(accounts, 1);
}

/// 자격증명이 없으면 503 이다. 500 이면 고장으로, 404 면 오타로 읽힌다.
#[sqlx::test]
async fn google_and_payments_are_503_when_not_configured(pool: PgPool) {
    let g = call(&pool, "GET", "/api/auth/google", None, None).await;
    assert_eq!(g.status, StatusCode::SERVICE_UNAVAILABLE);

    let w = call(
        &pool,
        "POST",
        "/api/payments/webhook",
        Some(json!({})),
        None,
    )
    .await;
    assert_eq!(w.status, StatusCode::SERVICE_UNAVAILABLE);
}
