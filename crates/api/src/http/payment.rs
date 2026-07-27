//! 결제 — Stripe Checkout.
//!
//! 카드 번호는 우리 서버를 지나가지 않는다. 결제창은 Stripe 가 자기 도메인에서
//! 띄우고, 우리는 주문을 만들어 그 창으로 보낸 뒤 승인 통보만 받는다.
//! 그래서 여기 어디에도 카드 필드가 없고, 앞으로도 있으면 안 된다.

use axum::{
    Json,
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use hmac::{Hmac, Mac as _};
use serde::Deserialize;
use serde_json::json;
use sha2::Sha256;

use super::{ApiError, ApiResult, AppState, auth::CurrentAccount};
use crate::repo;

#[derive(Clone)]
pub struct StripeConfig {
    pub secret_key: String,
    /// webhook 서명 검증에 쓰는 키. 이게 없으면 아무나 결제 완료를 보낼 수 있다.
    pub webhook_secret: String,
    pub success_url: String,
    pub cancel_url: String,
}

impl StripeConfig {
    /// 환경변수에서 읽는다. 하나라도 없으면 결제를 끈다.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Some(Self {
            secret_key: std::env::var("STRIPE_SECRET_KEY").ok()?,
            webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET").ok()?,
            success_url: std::env::var("STRIPE_SUCCESS_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5173/market?paid=1".to_owned()),
            cancel_url: std::env::var("STRIPE_CANCEL_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5173/market?canceled=1".to_owned()),
        })
    }
}

fn config(st: &AppState) -> Result<&StripeConfig, ApiError> {
    st.stripe
        .as_ref()
        .ok_or_else(|| ApiError::unavailable("payments are not configured on this server"))
}

#[derive(Deserialize)]
struct CheckoutSession {
    id: String,
    url: String,
}

#[derive(Deserialize)]
pub struct CartInput {
    pub asset_ids: Vec<i64>,
}

/// 상세 페이지에서 한 점만 바로 사는 길. 장바구니와 같은 함수를 쓴다.
///
/// # Errors
/// 결제가 꺼져 있거나 못 파는 에셋이거나 Stripe 호출이 실패하면 오류를 반환한다.
pub async fn checkout_one(
    State(st): State<AppState>,
    account: CurrentAccount,
    Path(asset_id): Path<i64>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    open_session(&st, account, &[asset_id]).await
}

/* 장바구니를 통째로 결제한다.

담긴 것 중 하나라도 못 사면 주문을 안 연다. 빼고 진행하면 셋을 담고
눌렀는데 둘만 결제되는 일이 생기고, 그건 되돌리기 어렵다. */
///
/// # Errors
/// 비어 있거나 못 사는 것이 섞였거나 Stripe 호출이 실패하면 오류를 반환한다.
pub async fn checkout_cart(
    State(st): State<AppState>,
    account: CurrentAccount,
    Json(input): Json<CartInput>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    open_session(&st, account, &input.asset_ids).await
}

/* 결제를 누르기 전에 장바구니를 확인한다.

장바구니는 브라우저에 있어서 며칠 전 상태가 그대로 남아 있다. 그 사이에
누가 내렸을 수도 있고, 내가 이미 샀을 수도 있다. */
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn review_cart(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
    Json(input): Json<CartInput>,
) -> ApiResult<Json<serde_json::Value>> {
    let blocked = repo::check_cart(&st.pool, account.id, &input.asset_ids).await?;
    Ok(Json(json!({ "blocked": blocked })))
}

/* 주문을 만들고 결제창 주소를 돌려준다.

주문을 먼저 만든 뒤 Stripe 세션을 연다. 순서가 반대면 결제는 됐는데
우리 쪽에 주문이 없는 상태가 생길 수 있다.

품목마다 줄을 세운다. 합계 한 줄로 보내면 결제창에 "LaughGG asset $74"
라고만 떠서, 무엇을 사는지 마지막 화면에서 확인할 수가 없다. */
async fn open_session(
    st: &AppState,
    CurrentAccount(account): CurrentAccount,
    asset_ids: &[i64],
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let cfg = config(st)?;
    let order = repo::open_order(&st.pool, account.id, asset_ids).await?;

    /* Stripe 는 폼 인코딩이라 `line_items[0][...]` 처럼 키에 번호가 들어간다.
    키를 만들어 두고 빌려 줘야 해서 문자열을 먼저 모은다. */
    let mut form: Vec<(String, String)> = vec![
        ("mode".into(), "payment".into()),
        ("success_url".into(), cfg.success_url.clone()),
        ("cancel_url".into(), cfg.cancel_url.clone()),
        ("client_reference_id".into(), order.id.to_string()),
        ("customer_email".into(), account.email.clone()),
    ];
    for (n, item) in order.items.iter().enumerate() {
        form.push((format!("line_items[{n}][quantity]"), "1".into()));
        form.push((
            format!("line_items[{n}][price_data][currency]"),
            "usd".into(),
        ));
        form.push((
            format!("line_items[{n}][price_data][unit_amount]"),
            item.amount_cents.to_string(),
        ));
        form.push((
            format!("line_items[{n}][price_data][product_data][name]"),
            item.title.clone(),
        ));
    }

    let session: CheckoutSession = reqwest::Client::new()
        .post("https://api.stripe.com/v1/checkout/sessions")
        .bearer_auth(&cfg.secret_key)
        .form(&form)
        .send()
        .await
        .map_err(|e| ApiError::bad_gateway(format!("stripe request failed: {e}")))?
        .error_for_status()
        .map_err(|e| ApiError::bad_gateway(format!("stripe rejected the session: {e}")))?
        .json()
        .await
        .map_err(|e| ApiError::bad_gateway(format!("stripe session body: {e}")))?;

    repo::attach_provider_ref(&st.pool, order.id, &session.id).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "order_id": order.id,
            "amount_cents": order.amount_cents,
            "checkout_url": session.url,
        })),
    ))
}

/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn my_orders(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
) -> ApiResult<Json<serde_json::Value>> {
    let orders = repo::list_orders(&st.pool, account.id).await?;
    Ok(Json(json!({ "count": orders.len(), "orders": orders })))
}

/* 내 라이브러리.

주문 목록과 다르다. 주문은 결제 내역이고 라이브러리는 소유 목록이라,
같은 에셋을 두 번 사도 한 줄이다. */
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn my_library(
    State(st): State<AppState>,
    CurrentAccount(account): CurrentAccount,
) -> ApiResult<Json<serde_json::Value>> {
    let owned = repo::my_library(&st.pool, account.id).await?;
    Ok(Json(json!({ "count": owned.len(), "assets": owned })))
}

#[derive(Deserialize)]
struct Event {
    #[serde(rename = "type")]
    kind: String,
    data: EventData,
}

#[derive(Deserialize)]
struct EventData {
    object: EventObject,
}

#[derive(Deserialize)]
struct EventObject {
    id: String,
}

/* 결제 완료 통보.

서명을 먼저 검증한다. 이게 없으면 누구나 결제 완료를 보내 에셋을 공짜로
가져간다 — 이 엔드포인트는 로그인 없이 열려 있어야 하기 때문이다.

본문을 바이트 그대로 받는다. serde 로 한 번 통과시킨 뒤 다시 직렬화하면
키 순서와 공백이 달라져 서명이 안 맞는다. */
/// # Errors
/// 서명이 없거나 안 맞거나 주문을 못 찾으면 오류를 반환한다.
pub async fn webhook(
    State(st): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<Json<serde_json::Value>> {
    let cfg = config(&st)?;

    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::bad_request("missing stripe-signature header"))?;

    verify_signature(signature, &body, &cfg.webhook_secret)?;

    let event: Event = serde_json::from_slice(&body)
        .map_err(|e| ApiError::bad_request(format!("unreadable event: {e}")))?;

    // 관심 있는 건 하나뿐이다. 나머지는 200 으로 받아 준다 — 오류를 내면
    // Stripe 가 계속 재시도한다.
    if event.kind != "checkout.session.completed" {
        return Ok(Json(json!({ "ignored": event.kind })));
    }

    let paid = repo::mark_paid(&st.pool, &event.data.object.id).await?;
    Ok(Json(json!(paid)))
}

/* Stripe 서명 검증.

헤더는 `t=<타임스탬프>,v1=<서명>` 꼴이다. 서명 대상은 `타임스탬프.본문` 이다.

비교를 상수 시간으로 한다. 문자열 비교는 다른 바이트가 나오는 순간 멈춰서,
응답 시간만 재도 서명을 한 바이트씩 맞춰 갈 수 있다. Mac::verify_slice 가
그 일을 해 준다. */
fn verify_signature(header: &str, body: &[u8], secret: &str) -> Result<(), ApiError> {
    let mut timestamp = None;
    let mut signatures = Vec::new();
    for part in header.split(',') {
        match part.split_once('=') {
            Some(("t", v)) => timestamp = Some(v),
            Some(("v1", v)) => signatures.push(v),
            _ => {}
        }
    }

    let timestamp =
        timestamp.ok_or_else(|| ApiError::bad_request("signature header has no timestamp"))?;
    if signatures.is_empty() {
        return Err(ApiError::bad_request(
            "signature header has no v1 signature",
        ));
    }

    // 서명 후보마다 새 MAC 을 만든다. verify_slice 가 인스턴스를 소비하고,
    // 그게 곧 상수 시간 비교를 해 주는 유일한 경로다.
    let mac = || -> Result<Hmac<Sha256>, ApiError> {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
            .map_err(|e| ApiError::internal(format!("bad webhook secret: {e}")))?;
        mac.update(timestamp.as_bytes());
        mac.update(b".");
        mac.update(body);
        Ok(mac)
    };

    // 키가 틀린 건 우리 설정 문제다. 서명이 안 맞는 것과 구분해서 낸다.
    mac()?;

    let ok = signatures.iter().any(|s| {
        hex::decode(s)
            .ok()
            .zip(mac().ok())
            .is_some_and(|(given, m)| m.verify_slice(&given).is_ok())
    });

    if ok {
        Ok(())
    } else {
        Err(ApiError::bad_request("signature did not match"))
    }
}

#[cfg(test)]
mod tests {
    use super::verify_signature;

    fn sign(secret: &str, timestamp: &str, body: &[u8]) -> String {
        use hmac::{Hmac, Mac as _};
        use sha2::Sha256;
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("mac");
        mac.update(timestamp.as_bytes());
        mac.update(b".");
        mac.update(body);
        format!(
            "t={timestamp},v1={}",
            hex::encode(mac.finalize().into_bytes())
        )
    }

    #[test]
    fn a_correct_signature_passes() {
        let body = br#"{"type":"checkout.session.completed"}"#;
        let header = sign("whsec_test", "1700000000", body);
        assert!(verify_signature(&header, body, "whsec_test").is_ok());
    }

    #[test]
    fn a_tampered_body_fails() {
        let body = br#"{"type":"checkout.session.completed"}"#;
        let header = sign("whsec_test", "1700000000", body);
        // 본문이 한 글자만 달라도 통과하면 안 된다.
        assert!(
            verify_signature(
                &header,
                br#"{"type":"checkout.session.complered"}"#,
                "whsec_test"
            )
            .is_err()
        );
    }

    #[test]
    fn a_wrong_secret_fails() {
        let body = b"{}";
        let header = sign("whsec_test", "1700000000", body);
        assert!(verify_signature(&header, body, "whsec_other").is_err());
    }

    #[test]
    fn a_malformed_header_fails() {
        let body = b"{}";
        for bad in ["", "nonsense", "t=1", "v1=abc"] {
            assert!(
                verify_signature(bad, body, "whsec_test").is_err(),
                "{bad:?}"
            );
        }
    }
}
