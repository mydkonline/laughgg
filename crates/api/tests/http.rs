//! HTTP 계층 통합 테스트.
//!
//! 라우터를 직접 호출한다. 포트를 열면 테스트끼리 부딪히고, 그 포트가 이미
//! 쓰이는지 여부에 결과가 달라진다 — 실제로 확인하다 낡은 서버 응답을 받고
//! 한참 헤맸다.
//!
//! 여기서 보는 건 하나다. 오류가 종류대로 갈리는가. 한때 전부 500 이라
//! 클라이언트가 "내 요청이 틀렸나, 서버가 죽었나" 를 구분할 수 없었다.

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt as _;
use laughgg_api::http::{AppState, router};
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt as _;

/// 로그인해서 세션 쿠키를 받는다.
async fn a_session(pool: &PgPool, email: &str) -> String {
    let res = router(AppState::bare(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "email": email, "password": "goodpassword" }).to_string(),
                ))
                .expect("요청"),
        )
        .await
        .expect("가입");
    res.headers()
        .get_all(axum::http::header::SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .find(|v| v.starts_with("laughgg_session="))
        .map(|v| v.split(';').next().unwrap_or(v).to_owned())
        .expect("세션 쿠키")
}

fn an_asset(title: &str) -> Value {
    json!({
        "title": title, "category": "prop", "engine": "unity",
        "art_style": "realistic", "price_usd": 30.0, "scores": scores(90)
    })
}

async fn call_as(
    pool: &PgPool,
    method: &str,
    uri: &str,
    body: Option<Value>,
    cookie: Option<&str>,
) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    if let Some(c) = cookie {
        req = req.header(axum::http::header::COOKIE, c);
    }
    let req = match body {
        Some(b) => req
            .header("content-type", "application/json")
            .body(Body::from(b.to_string())),
        None => req.body(Body::empty()),
    }
    .expect("요청 생성");

    let res = router(AppState::bare(pool.clone()))
        .oneshot(req)
        .await
        .expect("라우터 호출");
    let status = res.status();
    let bytes = res.into_body().collect().await.expect("본문").to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

fn scores(v: u8) -> Value {
    json!({
        "mesh_integrity": v, "texture_quality": v, "lod_setup": v, "runtime_cost": v,
        "license_clean": v, "code_quality": v, "integration": v
    })
}

async fn call(pool: &PgPool, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let req = Request::builder().method(method).uri(uri);
    let req = match body {
        Some(b) => req
            .header("content-type", "application/json")
            .body(Body::from(b.to_string())),
        None => req.body(Body::empty()),
    }
    .expect("요청 생성");

    let res = router(AppState::bare(pool.clone()))
        .oneshot(req)
        .await
        .expect("라우터 호출");
    let status = res.status();
    let bytes = res.into_body().collect().await.expect("본문").to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

#[sqlx::test]
async fn health_reports_the_service_name(pool: PgPool) {
    let (status, body) = call(&pool, "GET", "/api/health", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["service"], "laughgg-api");
}

/* 등록에는 로그인이 필요하다.

예전에는 creator_handle 을 문자열로 받아서 로그인 없이 아무 이름으로나
올릴 수 있었다. 그 이름이 곧 정산 대상이라 사칭이 그대로 통했다. */
#[sqlx::test]
async fn creating_an_asset_requires_a_session(pool: PgPool) {
    let anon = call(
        &pool,
        "POST",
        "/api/assets",
        Some(an_asset("Gothic Statue")),
    )
    .await;
    assert_eq!(anon.0, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn creating_an_asset_returns_201(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let (status, body) = call_as(
        &pool,
        "POST",
        "/api/assets",
        Some(an_asset("Gothic Statue")),
        Some(&cookie),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["badge"], "challenger");
    assert_eq!(body["total"], 90);
}

/// 올린 사람이 창작자다. 요청에 이름을 실어도 무시된다.
#[sqlx::test]
async fn the_uploader_is_the_creator(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let mut body = an_asset("Gothic Statue");
    // 남의 이름을 끼워 넣어 본다. 서버가 안 읽어야 한다.
    body["creator_handle"] = json!("someone-else");
    let (status, _) = call_as(&pool, "POST", "/api/assets", Some(body), Some(&cookie)).await;
    assert_eq!(status, StatusCode::CREATED);

    let (_, list) = call(&pool, "GET", "/api/assets", None).await;
    assert_eq!(
        list["assets"][0]["creator"], "sh",
        "요청에 적힌 이름이 아니라 로그인한 계정이 창작자여야 한다"
    );
}

/* 오류가 종류대로 갈리는가. 이 셋이 전부 500 이던 시절이 있었다. */
#[sqlx::test]
async fn missing_asset_is_404(pool: PgPool) {
    let (status, body) = call(
        &pool,
        "POST",
        "/api/assets/9999/review",
        Some(json!({ "scores": scores(80) })),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(
        body["error"].as_str().is_some_and(|e| e.contains("9999")),
        "어느 에셋이 없는지 알려 줘야 한다: {body}"
    );
}

#[sqlx::test]
async fn out_of_range_scores_are_400(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let mut bad = an_asset("Bad");
    bad["scores"]["mesh_integrity"] = json!(200);
    let (status, _) = call_as(&pool, "POST", "/api/assets", Some(bad), Some(&cookie)).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

/* 등록과 재검수가 다른 경로인가. 한때 둘이 같은 핸들러였다. */
#[sqlx::test]
async fn review_route_does_not_create_an_asset(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let (_, created) = call_as(
        &pool,
        "POST",
        "/api/assets",
        Some(an_asset("Gothic Statue")),
        Some(&cookie),
    )
    .await;
    let id = created["asset_id"].as_i64().expect("에셋 id");

    let (status, _) = call(
        &pool,
        "POST",
        &format!("/api/assets/{id}/review"),
        Some(json!({ "scores": scores(40) })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (_, metrics) = call(&pool, "GET", "/api/metrics", None).await;
    assert_eq!(metrics["assets"], 1, "재검수로 에셋이 늘면 안 된다");
    assert_eq!(metrics["reviewed"], 2);

    let (_, list) = call(&pool, "GET", "/api/assets", None).await;
    assert_eq!(list["total"], 1, "목록도 한 줄이어야 한다");
}

#[sqlx::test]
async fn facets_and_list_agree(pool: PgPool) {
    let (status, facets) = call(&pool, "GET", "/api/games/facets", None).await;
    assert_eq!(status, StatusCode::OK);

    let unity = facets["engine"]
        .as_array()
        .expect("엔진 축")
        .iter()
        .find(|f| f["value"] == "Unity")
        .expect("Unity")["count"]
        .as_i64()
        .expect("개수");

    let (_, page) = call(&pool, "GET", "/api/games?engine=Unity", None).await;
    assert_eq!(page["total"], unity);
}

#[sqlx::test]
async fn unknown_route_falls_through_to_static(pool: PgPool) {
    // /api 아래에 없는 경로는 정적 파일 서빙으로 넘어가고, 파일도 없으면 404 다.
    let (status, _) = call(&pool, "GET", "/api/nope", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

/// 헬스체크가 DB 를 실제로 본다. 문자열만 돌려주면 DB 가 죽어도 ok 가 나간다.
#[sqlx::test]
async fn health_reports_what_is_configured(pool: PgPool) {
    let (status, body) = call(&pool, "GET", "/api/health", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["database"], "up");
    assert_eq!(body["google"], false, "테스트는 자격증명 없이 돈다");
    assert_eq!(body["payments"], false);
}

#[sqlx::test]
async fn asset_detail_is_served(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let (_, created) = call_as(
        &pool,
        "POST",
        "/api/assets",
        Some(an_asset("Gothic Statue")),
        Some(&cookie),
    )
    .await;
    let id = created["asset_id"].as_i64().expect("id");

    let (status, body) = call(&pool, "GET", &format!("/api/assets/{id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["title"], "Gothic Statue");
    assert_eq!(body["scores"]["license_clean"], 90);

    let (missing, _) = call(&pool, "GET", "/api/assets/9999", None).await;
    assert_eq!(missing, StatusCode::NOT_FOUND);
}

/// 목록과 패싯이 같은 조건을 본다.
#[sqlx::test]
async fn asset_facets_and_list_agree(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    for title in ["a", "b"] {
        call_as(
            &pool,
            "POST",
            "/api/assets",
            Some(an_asset(title)),
            Some(&cookie),
        )
        .await;
    }

    let (_, facets) = call(&pool, "GET", "/api/assets/facets", None).await;
    let prop = facets["category"]
        .as_array()
        .expect("분류 축")
        .iter()
        .find(|f| f["value"] == "prop")
        .expect("prop")["count"]
        .as_i64()
        .expect("개수");

    let (_, page) = call(&pool, "GET", "/api/assets?category=prop", None).await;
    assert_eq!(page["total"], prop);
}
