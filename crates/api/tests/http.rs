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

#[sqlx::test]
async fn creating_an_asset_returns_201(pool: PgPool) {
    let (status, body) = call(
        &pool,
        "POST",
        "/api/assets",
        Some(json!({
            "creator_handle": "sh", "title": "Gothic Statue", "category": "prop",
            "engine": "unity", "art_style": "realistic", "price_usd": 30.0,
            "scores": scores(90)
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["badge"], "challenger");
    assert_eq!(body["total"], 90);
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
    let (status, _) = call(
        &pool,
        "POST",
        "/api/assets",
        Some(json!({
            "creator_handle": "sh", "title": "Bad", "category": "prop",
            "engine": "unity", "art_style": "realistic", "price_usd": 30.0,
            "scores": { "mesh_integrity": 200, "texture_quality": 80, "lod_setup": 80,
                        "runtime_cost": 80, "license_clean": 80, "code_quality": 80,
                        "integration": 80 }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

/* 등록과 재검수가 다른 경로인가. 한때 둘이 같은 핸들러였다. */
#[sqlx::test]
async fn review_route_does_not_create_an_asset(pool: PgPool) {
    let (_, created) = call(
        &pool,
        "POST",
        "/api/assets",
        Some(json!({
            "creator_handle": "sh", "title": "Gothic Statue", "category": "prop",
            "engine": "unity", "art_style": "realistic", "price_usd": 30.0,
            "scores": scores(90)
        })),
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
    assert_eq!(list["count"], 1, "목록도 한 줄이어야 한다");
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
