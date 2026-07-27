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
    domain::{Facts, Origin},
    http::{AppState, payment::StripeConfig, router},
    repo::{self, NewAsset, RepoError},
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
        storage: None,
        cors_origins: Vec::new(),
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

/* 검수를 붙인다.

등록만으로는 못 판다. 파일을 뜯어야 채점이 되고, 채점 전에는 배지가 없다.
테스트도 그 순서를 따라야 한다. */
async fn review(pool: &PgPool, asset_id: i64, origin: Origin) {
    let facts = Facts {
        triangles: 8_000,
        materials: 1,
        meshes: 1,
        primitives: 1,
        texture_sides: vec![2048],
        ..Facts::default()
    };
    let analysis = laughgg_api::domain::analyze(&facts, origin);
    repo::record_analysis(pool, asset_id, &analysis, &serde_json::json!({}))
        .await
        .expect("분석");
}

fn an_asset(title: &str) -> NewAsset {
    NewAsset {
        title: title.into(),
        category: "prop".into(),
        engine: "unity".into(),
        art_style: "realistic".into(),
        price_usd: 30.0,
        origin: "self_made".into(),
        file: None,
    }
}

/// 살 사람과 팔 에셋 하나.
async fn a_buyer_and_asset(pool: &PgPool) -> (i64, i64) {
    let buyer = repo::sign_up(
        pool,
        &laughgg_api::domain::Credentials {
            email: "buyer@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("구매자")
    .id;
    let maker = repo::sign_up(
        pool,
        &laughgg_api::domain::Credentials {
            email: "maker@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("창작자")
    .id;
    let asset = repo::create_asset(pool, maker, &an_asset("Gothic Statue"))
        .await
        .expect("에셋");
    review(pool, asset, Origin::PublicDomain).await;
    (buyer, asset)
}

/* 결제 대상이 될 계정과 주문 하나를 만든다.

사는 사람과 만든 사람이 달라야 한다. 만든 사람은 이미 그 에셋을 가진
것으로 치기 때문에 자기 물건을 자기가 살 수 없다. */
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
    let maker = repo::sign_up(
        pool,
        &laughgg_api::domain::Credentials {
            email: "maker@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("창작자");

    let asset = repo::create_asset(
        pool,
        maker.id,
        &NewAsset {
            title: "Gothic Statue".into(),
            category: "prop".into(),
            engine: "unity".into(),
            art_style: "realistic".into(),
            price_usd: 30.0,
            origin: "self_made".into(),
            file: None,
        },
    )
    .await
    .expect("에셋");
    review(pool, asset, Origin::PublicDomain).await;

    let order = repo::open_order(pool, account.id, &[asset])
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

    let asset = repo::create_asset(&pool, account.id, &an_asset("Blocked"))
        .await
        .expect("에셋");
    // 출처를 안 밝히면 실버다. 다른 점수가 아무리 좋아도 그렇다.
    review(&pool, asset, Origin::Unknown).await;

    let err = repo::open_order(&pool, account.id, &[asset])
        .await
        .expect_err("실버는 주문도 안 된다");
    assert!(
        matches!(err, repo::RepoError::AssetNotSellable { .. }),
        "{err:?}"
    );
}

/* 라이브러리는 소유 목록이지 결제 내역이 아니다. */
#[sqlx::test]
async fn the_library_lists_only_paid_assets(pool: PgPool) {
    let account = repo::sign_up(
        &pool,
        &laughgg_api::domain::Credentials {
            email: "buyer@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("가입");
    let maker = repo::sign_up(
        &pool,
        &laughgg_api::domain::Credentials {
            email: "maker@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("창작자");

    let bought = repo::create_asset(&pool, maker.id, &an_asset("Bought"))
        .await
        .expect("에셋 1");
    review(&pool, bought, Origin::PublicDomain).await;
    let browsed = repo::create_asset(&pool, maker.id, &an_asset("Only Browsed"))
        .await
        .expect("에셋 2");
    review(&pool, browsed, Origin::PublicDomain).await;

    // 하나는 결제까지, 하나는 주문만 열어 둔다.
    let order = repo::open_order(&pool, account.id, &[bought])
        .await
        .expect("주문");
    repo::attach_provider_ref(&pool, order.id, "cs_lib")
        .await
        .expect("세션 id");
    repo::mark_paid(&pool, "cs_lib").await.expect("결제 확정");

    repo::open_order(&pool, account.id, &[browsed])
        .await
        .expect("결제 안 한 주문");

    let library = repo::my_library(&pool, account.id)
        .await
        .expect("라이브러리");
    assert_eq!(library.len(), 1, "결제 안 한 건 라이브러리에 없어야 한다");
    assert_eq!(library[0].title, "Bought");
    assert!((library[0].paid_usd - 30.0).abs() < 1e-9);
}

/* 같은 에셋을 두 번 사도 라이브러리에는 한 줄이다.

이미 가진 것은 담을 수 없게 막았지만, 그 확인은 결제가 끝난 것만 본다.
결제창을 두 개 열어 두고 둘 다 내면 여기까지 온다 — 창을 두 번 여는 건
누구나 하는 일이라 없는 일로 칠 수 없다. 소유 목록은 산 횟수가 아니라
가진 것을 세야 한다. */
#[sqlx::test]
async fn paying_twice_shows_one_entry(pool: PgPool) {
    let (account, asset_id) = a_buyer_and_asset(&pool).await;

    // 결제하기 전에 주문을 둘 다 연다. 순서를 바꾸면 두 번째가 거절된다.
    let mut opened = Vec::new();
    for reference in ["cs_a", "cs_b"] {
        let order = repo::open_order(&pool, account, &[asset_id])
            .await
            .expect("주문");
        repo::attach_provider_ref(&pool, order.id, reference)
            .await
            .expect("세션 id");
        opened.push(reference);
    }
    for reference in opened {
        repo::mark_paid(&pool, reference).await.expect("결제");
    }

    let library = repo::my_library(&pool, account).await.expect("라이브러리");
    assert_eq!(library.len(), 1, "소유 목록은 산 횟수를 세지 않는다");

    let orders = repo::list_orders(&pool, account).await.expect("주문 목록");
    assert_eq!(orders.len(), 2, "주문 내역은 두 건이어야 한다");
}

/* 이미 가진 것은 못 담는다.

받는 것이 파일이라 두 번 사도 얻는 게 없다. 막지 않으면 장바구니에 며칠
남아 있던 줄 때문에 같은 값을 두 번 내게 된다. */
#[sqlx::test]
async fn an_asset_you_already_own_cannot_be_bought_again(pool: PgPool) {
    let (account, asset_id) = a_buyer_and_asset(&pool).await;

    let order = repo::open_order(&pool, account, &[asset_id])
        .await
        .expect("첫 주문");
    repo::attach_provider_ref(&pool, order.id, "cs_owned")
        .await
        .expect("세션 id");
    repo::mark_paid(&pool, "cs_owned").await.expect("결제");

    let err = repo::open_order(&pool, account, &[asset_id])
        .await
        .expect_err("이미 가진 것은 거절해야 한다");
    assert!(
        matches!(err, RepoError::AlreadyOwned(id) if id == asset_id),
        "{err:?}"
    );

    // 화면이 무엇을 빼야 하는지 알 수 있어야 한다.
    let blocked = repo::check_cart(&pool, account, &[asset_id])
        .await
        .expect("장바구니 확인");
    assert_eq!(blocked.len(), 1);
    assert_eq!(blocked[0].asset_id, asset_id);
    assert!(
        blocked[0].reason.contains("이미"),
        "{:?}",
        blocked[0].reason
    );
}

/* 하나가 막히면 주문 전체를 거절한다.

빼고 진행하면 셋을 담고 눌렀는데 둘만 결제된다. 결제가 끝난 뒤에
"하나는 빠졌습니다" 라고 알리는 건 되돌리기가 어렵다. */
#[sqlx::test]
async fn one_blocked_item_rejects_the_whole_cart(pool: PgPool) {
    let (account, good) = a_buyer_and_asset(&pool).await;
    let maker = repo::sign_up(
        &pool,
        &laughgg_api::domain::Credentials {
            email: "other-maker@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("창작자")
    .id;
    // 채점을 안 받은 에셋. 배지가 없으면 못 판다.
    let unscored = repo::create_asset(&pool, maker, &an_asset("Unscored"))
        .await
        .expect("에셋");

    let err = repo::open_order(&pool, account, &[good, unscored])
        .await
        .expect_err("하나가 막히면 전체가 막혀야 한다");
    assert!(matches!(err, RepoError::AssetNotReviewed(_)), "{err:?}");

    let orders = repo::list_orders(&pool, account).await.expect("주문 목록");
    assert!(orders.is_empty(), "거절된 주문이 남으면 안 된다");
}

/* 여러 점을 한 번에 사면 판매도 그만큼 남는다.

한때 sales.order_id 에 유일 인덱스가 걸려 있어서 주문당 판매가 한 건만
들어갔다. 그 상태로 장바구니를 붙이면 두 번째 창작자부터 정산을 못 받는다. */
#[sqlx::test]
async fn a_cart_records_a_sale_for_every_item(pool: PgPool) {
    let (account, first) = a_buyer_and_asset(&pool).await;
    let maker = repo::sign_up(
        &pool,
        &laughgg_api::domain::Credentials {
            email: "second-maker@op.gg".into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("창작자")
    .id;
    let second = repo::create_asset(&pool, maker, &an_asset("Second"))
        .await
        .expect("에셋");
    review(&pool, second, Origin::PublicDomain).await;

    let order = repo::open_order(&pool, account, &[first, second])
        .await
        .expect("주문");
    assert_eq!(order.items.len(), 2);
    assert_eq!(
        order.amount_cents,
        order.items.iter().map(|i| i.amount_cents).sum::<i32>(),
        "합계가 줄의 합과 달라지면 결제 금액이 틀려진다"
    );

    repo::attach_provider_ref(&pool, order.id, "cs_cart")
        .await
        .expect("세션 id");
    let paid = repo::mark_paid(&pool, "cs_cart").await.expect("결제");
    assert_eq!(paid.asset_ids.len(), 2);
    assert_eq!(paid.settlements.len(), 2, "창작자마다 정산이 하나씩 나온다");

    let library = repo::my_library(&pool, account).await.expect("라이브러리");
    assert_eq!(library.len(), 2, "둘 다 들어와야 한다");

    let sales: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sales WHERE order_id = $1")
        .bind(order.id)
        .fetch_one(&pool)
        .await
        .expect("판매 수");
    assert_eq!(sales, 2, "판매가 한 건만 남으면 한쪽이 정산에서 사라진다");
}

#[sqlx::test]
async fn the_library_needs_a_session(pool: PgPool) {
    let res = router(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/me/library")
                .body(Body::empty())
                .expect("요청"),
        )
        .await
        .expect("라우터");
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

/// 산 사람과 만든 사람이 쓸 수 있다. 만든 사람을 빼면 자기 것을 자기가 못 받는다.
#[sqlx::test]
async fn ownership_covers_buyers_and_the_creator(pool: PgPool) {
    let (buyer, asset_id) = a_buyer_and_asset(&pool).await;
    let maker: i64 = sqlx::query_scalar(
        "SELECT c.account_id FROM assets a JOIN creators c ON c.id = a.creator_id WHERE a.id = $1",
    )
    .bind(asset_id)
    .fetch_one(&pool)
    .await
    .expect("창작자 계정");

    assert!(
        repo::owns_asset(&pool, maker, asset_id)
            .await
            .expect("확인"),
        "만든 사람은 언제나 쓸 수 있어야 한다"
    );
    assert!(
        !repo::owns_asset(&pool, buyer, asset_id)
            .await
            .expect("확인"),
        "아직 안 샀으면 못 쓴다"
    );

    let order = repo::open_order(&pool, buyer, &[asset_id])
        .await
        .expect("주문");
    repo::attach_provider_ref(&pool, order.id, "cs_own")
        .await
        .expect("세션 id");
    repo::mark_paid(&pool, "cs_own").await.expect("결제");

    assert!(
        repo::owns_asset(&pool, buyer, asset_id)
            .await
            .expect("확인"),
        "결제하면 쓸 수 있어야 한다"
    );
}
