//! 결제 통보 통합 테스트.
//!
//! webhook 은 로그인 없이 열려 있는 유일한 경로다. 서명 검증이 유일한 방어라,
//! 핸들러가 그걸 실제로 부르는지까지 봐야 한다. 검증 함수만 단위 테스트하면
//! 누가 호출을 지워도 전부 통과한다 — 실제로 그랬다.

use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use hmac::{Hmac, Mac as _};
use http_body_util::BodyExt as _;
use laughgg_api::{
    domain::ReviewScores,
    http::{AppState, payment::StripeConfig, router},
    repo::{self, NewAsset},
};
use serde_json::{Value, json};
use sha2::Sha256;
use sqlx::PgPool;
use tower::ServiceExt as _;

const SECRET: &str = "whsec_test_secret";

fn state(pool: PgPool) -> AppState {
    AppState {
        pool,
        secure_cookies: false,
        google: None,
        stripe: Some(StripeConfig {
            secret_key: "sk_test_unused".into(),
            webhook_secret: SECRET.into(),
            success_url: "http://localhost/ok".into(),
            cancel_url: "http://localhost/no".into(),
        }),
    }
}

/// Stripe 가 붙이는 서명. `t=<ts>,v1=<hmac(ts.body)>` 꼴이다.
fn sign(body: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).expect("mac");
    mac.update(b"1700000000");
    mac.update(b".");
    mac.update(body.as_bytes());
    format!(
        "t=1700000000,v1={}",
        hex::encode(mac.finalize().into_bytes())
    )
}

async fn post_webhook(pool: &PgPool, body: &str, signature: Option<&str>) -> (StatusCode, Value) {
    let mut req = Request::builder()
        .method("POST")
        .uri("/api/payments/webhook")
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(s) = signature {
        req = req.header("stripe-signature", s);
    }
    let res = router(state(pool.clone()))
        .oneshot(req.body(Body::from(body.to_owned())).expect("요청"))
        .await
        .expect("라우터");
    let status = res.status();
    let bytes = res.into_body().collect().await.expect("본문").to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

fn scores(v: u8) -> ReviewScores {
    ReviewScores {
        mesh_integrity: v,
        texture_quality: v,
        lod_setup: v,
        runtime_cost: v,
        license_clean: v,
        code_quality: v,
        integration: v,
    }
}

/// 결제 대상이 될 계정과 주문 하나를 만든다.
async fn an_order(pool: &PgPool, session_id: &str) -> i64 {
    let account = repo::sign_up(
        pool,
        &laughgg_api::domain::Credentials {
            email: "sh@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("가입");

    let asset = repo::create_asset(
        pool,
        &NewAsset {
            creator_handle: "maker".into(),
            title: "Gothic Statue".into(),
            category: "prop".into(),
            engine: "unity".into(),
            art_style: "realistic".into(),
            price_usd: 30.0,
            scores: scores(90),
        },
    )
    .await
    .expect("에셋");

    let order = repo::open_order(pool, account.id, asset.asset_id)
        .await
        .expect("주문");
    repo::attach_provider_ref(pool, order.id, session_id)
        .await
        .expect("세션 id 연결");
    order.id
}

/* 서명이 없거나 틀리면 거절해야 한다.

이게 안 되면 누구나 결제 완료를 보내 에셋을 공짜로 가져간다. */
#[sqlx::test]
async fn an_unsigned_webhook_is_rejected(pool: PgPool) {
    let body =
        json!({"type":"checkout.session.completed","data":{"object":{"id":"cs_1"}}}).to_string();

    let (no_sig, _) = post_webhook(&pool, &body, None).await;
    assert_eq!(no_sig, StatusCode::BAD_REQUEST, "서명이 없으면 거절");

    let (bad_sig, _) = post_webhook(&pool, &body, Some("t=1700000000,v1=00")).await;
    assert_eq!(bad_sig, StatusCode::BAD_REQUEST, "서명이 틀리면 거절");
}

/// 본문이 한 글자만 바뀌어도 서명이 안 맞아야 한다.
#[sqlx::test]
async fn a_tampered_body_is_rejected(pool: PgPool) {
    let original =
        json!({"type":"checkout.session.completed","data":{"object":{"id":"cs_1"}}}).to_string();
    let signature = sign(&original);
    let tampered = original.replace("cs_1", "cs_2");

    let (status, _) = post_webhook(&pool, &tampered, Some(&signature)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn a_signed_completion_marks_the_order_paid_and_records_the_sale(pool: PgPool) {
    let order_id = an_order(&pool, "cs_paid").await;
    let body =
        json!({"type":"checkout.session.completed","data":{"object":{"id":"cs_paid"}}}).to_string();

    let (status, body_json) = post_webhook(&pool, &body, Some(&sign(&body))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body_json["order_id"], order_id);
    assert_eq!(body_json["already_paid"], false);

    let status_now: String = sqlx::query_scalar("SELECT status FROM orders WHERE id = $1")
        .bind(order_id)
        .fetch_one(&pool)
        .await
        .expect("주문 상태");
    assert_eq!(status_now, "paid");

    let m = repo::metrics(&pool).await.expect("집계");
    assert!(
        (m.monthly_fee_usd - 2.4).abs() < 1e-9,
        "30 달러의 8% 가 수수료 매출에 잡혀야 한다: {}",
        m.monthly_fee_usd
    );
}

/* Stripe 는 같은 이벤트를 여러 번 보낸다. 두 번 와도 판매는 한 번이어야 한다. */
#[sqlx::test]
async fn a_repeated_notification_does_not_double_charge(pool: PgPool) {
    an_order(&pool, "cs_twice").await;
    let body = json!({"type":"checkout.session.completed","data":{"object":{"id":"cs_twice"}}})
        .to_string();
    let signature = sign(&body);

    let (first, first_body) = post_webhook(&pool, &body, Some(&signature)).await;
    assert_eq!(first, StatusCode::OK);
    assert_eq!(first_body["already_paid"], false);

    let (second, second_body) = post_webhook(&pool, &body, Some(&signature)).await;
    assert_eq!(
        second,
        StatusCode::OK,
        "재시도에 오류를 내면 Stripe 가 계속 보낸다"
    );
    assert_eq!(second_body["already_paid"], true);

    let sales: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sales")
        .fetch_one(&pool)
        .await
        .expect("판매 수");
    assert_eq!(sales, 1, "같은 주문으로 판매가 두 번 기록되면 안 된다");
}

/// 관심 없는 이벤트는 200 으로 받아 준다. 오류를 내면 재시도가 쌓인다.
#[sqlx::test]
async fn unrelated_events_are_acknowledged(pool: PgPool) {
    let body = json!({"type":"invoice.created","data":{"object":{"id":"in_1"}}}).to_string();
    let (status, body_json) = post_webhook(&pool, &body, Some(&sign(&body))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body_json["ignored"], "invoice.created");
}

/// 결제를 시작하려면 로그인해야 한다.
#[sqlx::test]
async fn checkout_requires_a_session(pool: PgPool) {
    let res = router(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/assets/1/checkout")
                .body(Body::empty())
                .expect("요청"),
        )
        .await
        .expect("라우터");
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

/// 못 파는 에셋은 주문도 안 받는다. 결제까지 시켜 놓고 거절하면 환불이 남는다.
#[sqlx::test]
async fn a_silver_asset_cannot_be_ordered(pool: PgPool) {
    let account = repo::sign_up(
        &pool,
        &laughgg_api::domain::Credentials {
            email: "sh@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("가입");

    let blocked = ReviewScores {
        license_clean: 10,
        ..scores(100)
    };
    let asset = repo::create_asset(
        &pool,
        &NewAsset {
            creator_handle: "maker".into(),
            title: "Blocked".into(),
            category: "prop".into(),
            engine: "unity".into(),
            art_style: "realistic".into(),
            price_usd: 30.0,
            scores: blocked,
        },
    )
    .await
    .expect("에셋");

    let err = repo::open_order(&pool, account.id, asset.asset_id)
        .await
        .expect_err("실버는 주문도 안 된다");
    assert!(
        matches!(err, repo::RepoError::AssetNotSellable { .. }),
        "{err:?}"
    );
}
