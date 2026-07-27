//! 주문.
//!
//! 결제는 Stripe 가 한다. 여기서 하는 일은 주문을 만들고, 승인 통보가 오면
//! 확정하고, 확정된 순간 판매를 기록하는 것뿐이다.

use anyhow::Context as _;
use serde::Serialize;
use sqlx::PgPool;

use super::{RepoError, RepoResult};
use crate::domain::{Badge, DEFAULT_FEE_RATE, Settlement};

#[derive(Debug, Serialize)]
pub struct Order {
    pub id: i64,
    pub asset_id: i64,
    pub amount_cents: i32,
    pub currency: String,
    pub status: String,
}

/* 주문을 연다.

금액을 요청에서 받지 않는다. 에셋 가격을 읽어 센트로 바꿔 박는다 —
실수로 다루면 반올림이 쌓이고, 클라이언트가 정하면 1센트짜리 주문이 생긴다.

못 파는 에셋은 주문도 안 받는다. 결제까지 시켜 놓고 마지막에 거절하면
환불 처리가 남는다. */
///
/// # Errors
/// 에셋이 없거나 검수를 못 받았거나 판매 가능 등급이 아니면 오류를 반환한다.
pub async fn open_order(pool: &PgPool, account_id: i64, asset_id: i64) -> RepoResult<Order> {
    let row: Option<(f64, Option<String>)> = sqlx::query_as(
        r"SELECT a.price_usd::double precision, r.badge
          FROM assets a
          LEFT JOIN LATERAL (
              SELECT badge FROM reviews rv WHERE rv.asset_id = a.id
              ORDER BY rv.reviewed_at DESC, rv.id DESC LIMIT 1
          ) r ON TRUE
          WHERE a.id = $1",
    )
    .bind(asset_id)
    .fetch_optional(pool)
    .await
    .context("loading asset for order")?;

    let (price_usd, badge_label) = row.ok_or(RepoError::AssetNotFound(asset_id))?;
    let label = badge_label.ok_or(RepoError::AssetNotReviewed(asset_id))?;
    let badge = Badge::from_label(&label)
        .ok_or_else(|| RepoError::Other(anyhow::anyhow!("unknown badge {label:?}")))?;
    if !badge.production_ready() {
        return Err(RepoError::AssetNotSellable {
            asset_id,
            badge: label,
        });
    }

    // 달러를 센트로. 0.5 를 더해 반올림한다 — 29.99 가 2998 이 되면 안 된다.
    #[expect(
        clippy::cast_possible_truncation,
        reason = "가격은 NUMERIC(10,2) 라 센트로 바꿔도 i32 를 넘지 않는다"
    )]
    let amount_cents = (price_usd * 100.0 + 0.5) as i32;
    if amount_cents <= 0 {
        return Err(RepoError::Other(anyhow::anyhow!(
            "asset {asset_id} has no sellable price"
        )));
    }

    let id: i64 = sqlx::query_scalar(
        r"INSERT INTO orders (account_id, asset_id, amount_cents) VALUES ($1, $2, $3)
          RETURNING id",
    )
    .bind(account_id)
    .bind(asset_id)
    .bind(amount_cents)
    .fetch_one(pool)
    .await
    .context("opening order")?;

    Ok(Order {
        id,
        asset_id,
        amount_cents,
        currency: "usd".into(),
        status: "pending".into(),
    })
}

/// 결제창을 띄우기 직전에 provider 식별자를 붙인다.
///
/// # Errors
/// 쓰기에 실패하면 오류를 반환한다.
pub async fn attach_provider_ref(
    pool: &PgPool,
    order_id: i64,
    provider_ref: &str,
) -> RepoResult<()> {
    sqlx::query("UPDATE orders SET provider_ref = $2 WHERE id = $1")
        .bind(order_id)
        .bind(provider_ref)
        .execute(pool)
        .await
        .context("attaching provider ref")?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct PaidOrder {
    pub order_id: i64,
    pub asset_id: i64,
    pub settlement: Settlement,
    /// 이미 처리된 통보였는가. Stripe 는 같은 이벤트를 여러 번 보낸다.
    pub already_paid: bool,
}

/* 결제를 확정한다.

Stripe 는 같은 이벤트를 여러 번 보낸다. 재시도 정책이 그래서, 두 번 오면
판매가 두 번 기록되는 구조는 언젠가 반드시 터진다. 상태를 pending 일 때만
바꾸고, 바뀐 행이 없으면 이미 처리된 것으로 본다.

판매 기록까지 같은 트랜잭션에 넣는다. 주문만 paid 가 되고 판매가 안 남으면
수수료 매출에서 사라진다. */
///
/// # Errors
/// 주문이 없거나 쓰기에 실패하면 오류를 반환한다.
pub async fn mark_paid(pool: &PgPool, provider_ref: &str) -> RepoResult<PaidOrder> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    let found: Option<(i64, i64, i32, String)> = sqlx::query_as(
        r"SELECT id, asset_id, amount_cents, status FROM orders
          WHERE provider_ref = $1 FOR UPDATE",
    )
    .bind(provider_ref)
    .fetch_optional(&mut *tx)
    .await
    .context("loading order")?;

    let (order_id, asset_id, amount_cents, status) = found.ok_or_else(|| {
        RepoError::Other(anyhow::anyhow!(
            "no order for provider ref {provider_ref:?}"
        ))
    })?;

    let price_usd = f64::from(amount_cents) / 100.0;
    let settlement = Settlement::new(price_usd, DEFAULT_FEE_RATE);

    if status != "pending" {
        tx.commit().await.context("committing")?;
        return Ok(PaidOrder {
            order_id,
            asset_id,
            settlement,
            already_paid: true,
        });
    }

    sqlx::query("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1")
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .context("marking order paid")?;

    sqlx::query(
        r"INSERT INTO sales (asset_id, price_usd, fee_rate, order_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING",
    )
    .bind(asset_id)
    .bind(price_usd)
    .bind(DEFAULT_FEE_RATE)
    .bind(order_id)
    .execute(&mut *tx)
    .await
    .context("recording sale for order")?;

    tx.commit().await.context("committing payment")?;

    Ok(PaidOrder {
        order_id,
        asset_id,
        settlement,
        already_paid: false,
    })
}

/// 내 주문 목록.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list_orders(pool: &PgPool, account_id: i64) -> RepoResult<Vec<Order>> {
    let rows = sqlx::query_as::<_, (i64, i64, i32, String, String)>(
        r"SELECT id, asset_id, amount_cents, currency, status FROM orders
          WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .context("listing orders")?;

    Ok(rows
        .into_iter()
        .map(|(id, asset_id, amount_cents, currency, status)| Order {
            id,
            asset_id,
            amount_cents,
            currency,
            status,
        })
        .collect())
}
