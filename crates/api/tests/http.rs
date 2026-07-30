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
        "art_style": "realistic", "price_usd": 30.0, "origin": "self_made"
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
async fn creating_an_asset_gives_no_badge(pool: PgPool) {
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
    assert_eq!(body["status"], "pending_analysis");
    assert!(body["badge"].is_null(), "안 쟀는데 배지가 나오면 안 된다");
}

/* 점수를 실어 보내도 안 읽는다.

요청에 100 점을 적어 보내는 게 제일 쉬운 공격이다. 서버가 그걸 그대로
쓰면 배지가 아무 의미가 없다. */
#[sqlx::test]
async fn scores_in_the_request_are_ignored(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let mut sneaky = an_asset("Sneaky");
    sneaky["scores"] = json!({
        "mesh_integrity": 100, "texture_quality": 100, "lod_setup": 100,
        "runtime_cost": 100, "license_clean": 100, "code_quality": 100,
        "integration": 100
    });
    let (status, body) = call_as(&pool, "POST", "/api/assets", Some(sneaky), Some(&cookie)).await;

    assert_eq!(status, StatusCode::CREATED);
    let id = body["asset_id"].as_i64().expect("id");

    let (_, detail) = call(&pool, "GET", &format!("/api/assets/{id}"), None).await;
    assert!(
        detail["badge"].is_null(),
        "요청에 적은 점수로 배지가 나왔다: {detail}"
    );
}

/* 분석이 배지를 만든다.

진짜 GLB 를 보내면 서버가 뜯어서 채점한다. 파일은 위조할 수 있어도
그 파일의 삼각형 수는 파일이 정한다. */
#[sqlx::test]
async fn analyzing_a_real_file_produces_the_badge(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let mut input = an_asset("Gothic Statue");
    input["origin"] = json!("public_domain");
    // 확장자로 형식을 고르므로 파일 키가 있어야 한다.
    input["file_key"] = json!("uploads/aa/statue.glb");
    input["file_bytes"] = json!(200_000);
    input["file_sha256"] = json!("a".repeat(64));
    let (_, created) = call_as(&pool, "POST", "/api/assets", Some(input), Some(&cookie)).await;
    let id = created["asset_id"].as_i64().expect("id");

    let glb: &[u8] = include_bytes!("../../../assets/dungeon/character-human.glb");
    let res = router(AppState::bare(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/assets/{id}/analyze"))
                .header(axum::http::header::COOKIE, &cookie)
                .body(Body::from(glb.to_vec()))
                .expect("요청"),
        )
        .await
        .expect("라우터");
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = res.into_body().collect().await.expect("본문").to_bytes();
    let body: Value = serde_json::from_slice(&bytes).expect("json");

    assert!(body["total"].as_i64().expect("총점") > 0);
    assert!(body["badge"].is_string());
    assert!(
        body["notes"].as_array().is_some_and(|n| !n.is_empty()),
        "점수만 주면 무엇을 고쳐야 할지 모른다"
    );
    // 메시 에셋에는 코드가 없다. 지어내지 않는다.
    assert!(body["scores"]["code_quality"].is_null());
}

/// 남의 에셋은 못 채점한다. 채점하면 배지를 남이 정하게 된다.
#[sqlx::test]
async fn a_stranger_cannot_analyze_someone_elses_asset(pool: PgPool) {
    let mine = a_session(&pool, "mine@op.gg").await;
    let (_, created) = call_as(
        &pool,
        "POST",
        "/api/assets",
        Some(an_asset("Mine")),
        Some(&mine),
    )
    .await;
    let id = created["asset_id"].as_i64().expect("id");

    let other = a_session(&pool, "other@op.gg").await;
    let res = router(AppState::bare(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/assets/{id}/analyze"))
                .header(axum::http::header::COOKIE, &other)
                .body(Body::from(vec![0_u8; 32]))
                .expect("요청"),
        )
        .await
        .expect("라우터");
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

/// 올린 사람이 창작자다. 요청에 이름을 실어도 무시된다.
#[sqlx::test]
async fn the_uploader_is_the_creator(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let mut body = an_asset("Gothic Statue");
    // 남의 이름을 끼워 넣어 본다. 서버가 안 읽어야 한다.
    body["creator_handle"] = json!("someone-else");
    let (status, created) = call_as(&pool, "POST", "/api/assets", Some(body), Some(&cookie)).await;
    assert_eq!(status, StatusCode::CREATED);
    let id = created["asset_id"].as_i64().expect("에셋 id");

    /* 방금 만든 것을 id 로 본다.

    목록 첫 줄로 보던 시절이 있었는데, 마이그레이션이 카탈로그를 시드한
    뒤로 배지 높은 시드가 위에 오면서 엉뚱한 줄을 검사했다. */
    let (_, detail) = call(&pool, "GET", &format!("/api/assets/{id}"), None).await;
    assert_eq!(
        detail["creator"], "sh",
        "요청에 적힌 이름이 아니라 로그인한 계정이 창작자여야 한다"
    );
}

/* 오류가 종류대로 갈리는가. 이 셋이 전부 500 이던 시절이 있었다. */
#[sqlx::test]
async fn missing_asset_is_404(pool: PgPool) {
    let (status, body) = call(&pool, "GET", "/api/assets/9999", None).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(
        body["error"].as_str().is_some_and(|e| e.contains("9999")),
        "어느 에셋이 없는지 알려 줘야 한다: {body}"
    );
}

#[sqlx::test]
async fn a_bad_file_key_is_400(pool: PgPool) {
    let cookie = a_session(&pool, "sh@op.gg").await;
    let mut bad = an_asset("Sneaky");
    // 상위 경로가 섞인 키. 스토리지에서 경로로 해석되면 남의 파일을 가리킨다.
    bad["file_key"] = json!("../../etc/passwd");
    bad["file_bytes"] = json!(100);
    bad["file_sha256"] = json!("a".repeat(64));
    let (status, _) = call_as(&pool, "POST", "/api/assets", Some(bad), Some(&cookie)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

/* 손으로 점수를 넣는 경로가 없는가.

등록에서 점수를 뺐는데 POST /assets/{id}/review 는 그대로 열려 있었다.
로그인도 안 받고 일곱 항목을 받아 배지를 새로 찍는 문이었다 — 앞문을
잠그고 뒷문을 열어 둔 셈이라, 고친 게 아무 소용이 없었다.

핸들러에 안 닿았다는 것과 배지가 안 붙었다는 것을 같이 본다. 상태 코드는
정적 파일 fallback 이 정하는데 그건 POST 에 405 를 준다 — 코드 하나만
보면 라우터를 어떻게 짰느냐에 테스트가 매인다. */
#[sqlx::test]
async fn there_is_no_manual_review_route(pool: PgPool) {
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

    let perfect = json!({ "scores": {
        "mesh_integrity": 100, "texture_quality": 100, "lod_setup": 100,
        "runtime_cost": 100, "license_clean": 100, "code_quality": 100,
        "integration": 100
    }});
    let (status, _) = call(
        &pool,
        "POST",
        &format!("/api/assets/{id}/review"),
        Some(perfect),
    )
    .await;
    assert!(
        status == StatusCode::NOT_FOUND || status == StatusCode::METHOD_NOT_ALLOWED,
        "채점하는 길은 analyze 하나다. 손으로 넣는 경로가 응답했다: {status}"
    );

    let (_, detail) = call(&pool, "GET", &format!("/api/assets/{id}"), None).await;
    assert!(detail["badge"].is_null(), "배지가 붙었다: {detail}");
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
    // 분석 전이라 점수가 없다. 안 쟀는데 숫자가 있으면 그게 문제다.
    assert!(body["scores"].is_null());

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
