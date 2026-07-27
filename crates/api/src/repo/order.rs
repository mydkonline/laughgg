//! 주문.
//!
//! 결제는 Stripe 가 한다. 여기서 하는 일은 주문을 만들고, 승인 통보가 오면
//! 확정하고, 확정된 순간 판매를 기록하는 것뿐이다.
//!
//! 주문 하나에 에셋이 여럿이다. 머리(`orders`)에 낸 값의 합이 있고 줄
//! (`order_items`)에 무엇을 샀는지가 있다.

use anyhow::Context as _;
use serde::Serialize;
use sqlx::{PgPool, Postgres, Transaction};

use super::{RepoError, RepoResult};
use crate::domain::{Badge, DEFAULT_FEE_RATE, Settlement};

/// 주문 한 줄에 들어가는 에셋 하나.
#[derive(Debug, Clone, Serialize)]
pub struct OrderItem {
    pub asset_id: i64,
    pub title: String,
    /// 그때 그 에셋의 값. 지금 가격이 아니다.
    pub amount_cents: i32,
}

#[derive(Debug, Serialize)]
pub struct Order {
    pub id: i64,
    pub items: Vec<OrderItem>,
    /// 줄의 합. 셀 수도 있지만 Stripe 에 보낸 값이 그대로 남아 있어야 한다.
    pub amount_cents: i32,
    pub currency: String,
    pub status: String,
}

/// 담았는데 못 사는 이유.
#[derive(Debug, Clone, Serialize)]
pub struct Rejected {
    pub asset_id: i64,
    /// 화면에 그대로 띄우는 말.
    pub reason: String,
}

/* 주문을 연다.

금액을 요청에서 받지 않는다. 에셋 가격을 읽어 센트로 바꿔 박는다 —
실수로 다루면 반올림이 쌓이고, 클라이언트가 정하면 1센트짜리 주문이 생긴다.

못 사는 것이 하나라도 섞이면 주문 자체를 거절한다. 빼고 진행하면 장바구니에
셋을 담고 결제를 눌렀는데 둘만 결제되는 일이 생기고, 그건 되돌리기 어렵다.
무엇이 왜 안 되는지는 [`check_cart`] 가 먼저 알려 준다. */
///
/// # Errors
/// 담긴 것이 없거나, 없는 에셋이거나, 검수 전이거나, 판매 가능 등급이
/// 아니거나, 이미 가진 것이면 오류를 반환한다.
pub async fn open_order(pool: &PgPool, account_id: i64, asset_ids: &[i64]) -> RepoResult<Order> {
    if asset_ids.is_empty() {
        return Err(RepoError::EmptyCart);
    }

    let mut tx = pool.begin().await.context("starting transaction")?;

    let mut items = Vec::with_capacity(asset_ids.len());
    let mut seen = std::collections::HashSet::new();
    for &asset_id in asset_ids {
        // 같은 것을 두 번 담아도 한 번만 센다. 파일이라 두 번 받아야 같다.
        if !seen.insert(asset_id) {
            continue;
        }
        items.push(priced_item(&mut tx, account_id, asset_id).await?);
    }

    let total: i32 = items.iter().map(|i| i.amount_cents).sum();

    let order_id: i64 = sqlx::query_scalar(
        "INSERT INTO orders (account_id, amount_cents) VALUES ($1, $2) RETURNING id",
    )
    .bind(account_id)
    .bind(total)
    .fetch_one(&mut *tx)
    .await
    .context("opening order")?;

    for item in &items {
        sqlx::query(
            "INSERT INTO order_items (order_id, asset_id, amount_cents) VALUES ($1, $2, $3)",
        )
        .bind(order_id)
        .bind(item.asset_id)
        .bind(item.amount_cents)
        .execute(&mut *tx)
        .await
        .context("adding order item")?;
    }

    tx.commit().await.context("committing order")?;

    Ok(Order {
        id: order_id,
        items,
        amount_cents: total,
        currency: "usd".into(),
        status: "pending".into(),
    })
}

/* 에셋 하나를 값과 함께 확인한다.

결제창을 띄우기 전에 걸러야 하는 것들이다. 결제까지 시켜 놓고 마지막에
거절하면 환불 처리가 남는다. */
async fn priced_item(
    tx: &mut Transaction<'_, Postgres>,
    account_id: i64,
    asset_id: i64,
) -> RepoResult<OrderItem> {
    let row: Option<(String, f64, Option<String>)> = sqlx::query_as(
        r"SELECT a.title, a.price_usd::double precision, r.badge
          FROM assets a
          LEFT JOIN LATERAL (
              SELECT badge FROM reviews rv WHERE rv.asset_id = a.id
              ORDER BY rv.reviewed_at DESC, rv.id DESC LIMIT 1
          ) r ON TRUE
          WHERE a.id = $1",
    )
    .bind(asset_id)
    .fetch_optional(&mut **tx)
    .await
    .context("loading asset for order")?;

    let (title, price_usd, badge_label) = row.ok_or(RepoError::AssetNotFound(asset_id))?;
    let label = badge_label.ok_or(RepoError::AssetNotReviewed(asset_id))?;
    let badge = Badge::from_label(&label)
        .ok_or_else(|| RepoError::Other(anyhow::anyhow!("unknown badge {label:?}")))?;
    if !badge.production_ready() {
        return Err(RepoError::AssetNotSellable {
            asset_id,
            badge: label,
        });
    }

    /* 이미 가진 것은 못 담는다.

    받는 것이 파일이라 두 번 사도 얻는 게 없다. 막지 않으면 장바구니에
    남아 있던 줄 때문에 같은 값을 두 번 내게 된다. */
    if owned_in_tx(tx, account_id, asset_id).await? {
        return Err(RepoError::AlreadyOwned(asset_id));
    }

    // 달러를 센트로. 0.5 를 더해 반올림한다 — 29.99 가 2998 이 되면 안 된다.
    #[expect(
        clippy::cast_possible_truncation,
        reason = "가격은 NUMERIC(10,2) 라 센트로 바꿔도 i32 를 넘지 않는다"
    )]
    let amount_cents = (price_usd * 100.0 + 0.5) as i32;
    if amount_cents <= 0 {
        // 무료 배포는 판매가 아니다. 500 으로 내면 우리 잘못처럼 보인다.
        return Err(RepoError::NotForSale(asset_id));
    }

    Ok(OrderItem {
        asset_id,
        title,
        amount_cents,
    })
}

/* 결제를 누르기 전에 장바구니를 본다.

주문은 하나라도 막히면 통째로 거절한다. 그런데 거절만 하고 무엇이
문제인지 안 알려 주면 화면에서 고칠 수가 없다 — 이 함수가 줄마다 이유를
붙여 준다. 화면은 그걸 보고 막힌 줄을 빼라고 안내한다. */
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn check_cart(
    pool: &PgPool,
    account_id: i64,
    asset_ids: &[i64],
) -> RepoResult<Vec<Rejected>> {
    let mut out = Vec::new();
    let mut tx = pool.begin().await.context("starting transaction")?;
    for &asset_id in asset_ids {
        if let Err(e) = priced_item(&mut tx, account_id, asset_id).await {
            let reason = match e {
                RepoError::AssetNotFound(_) => "지금은 없는 에셋입니다".to_owned(),
                RepoError::AssetNotReviewed(_) => "아직 채점 전입니다".to_owned(),
                RepoError::AssetNotSellable { .. } => "판매 가능 등급이 아닙니다".to_owned(),
                RepoError::AlreadyOwned(_) => "이미 가지고 있습니다".to_owned(),
                RepoError::NotForSale(_) => "무료 배포라 결제 대상이 아닙니다".to_owned(),
                other => return Err(other),
            };
            out.push(Rejected { asset_id, reason });
        }
    }
    tx.commit().await.context("committing check")?;
    Ok(out)
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
    /// 이 주문으로 넘어간 에셋들.
    pub asset_ids: Vec<i64>,
    /// 창작자 몫. 줄마다 나온다 — 파는 사람이 여럿일 수 있다.
    pub settlements: Vec<Settlement>,
    /// 이미 처리된 통보였는가. Stripe 는 같은 이벤트를 여러 번 보낸다.
    pub already_paid: bool,
}

/* 결제를 확정한다.

Stripe 는 같은 이벤트를 여러 번 보낸다. 재시도 정책이 그래서, 두 번 오면
판매가 두 번 기록되는 구조는 언젠가 반드시 터진다. 상태를 pending 일 때만
바꾸고, 바뀐 행이 없으면 이미 처리된 것으로 본다.

판매 기록까지 같은 트랜잭션에 넣는다. 주문만 paid 가 되고 판매가 안 남으면
수수료 매출에서 사라진다. 줄이 셋이면 판매도 셋이다 — 하나라도 빠지면
그 창작자가 정산을 못 받는다. */
///
/// # Errors
/// 주문이 없거나 쓰기에 실패하면 오류를 반환한다.
pub async fn mark_paid(pool: &PgPool, provider_ref: &str) -> RepoResult<PaidOrder> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    let found: Option<(i64, String)> =
        sqlx::query_as(r"SELECT id, status FROM orders WHERE provider_ref = $1 FOR UPDATE")
            .bind(provider_ref)
            .fetch_optional(&mut *tx)
            .await
            .context("loading order")?;

    let (order_id, status) = found.ok_or_else(|| {
        RepoError::Other(anyhow::anyhow!(
            "no order for provider ref {provider_ref:?}"
        ))
    })?;

    let lines: Vec<(i64, i32)> =
        sqlx::query_as("SELECT asset_id, amount_cents FROM order_items WHERE order_id = $1")
            .bind(order_id)
            .fetch_all(&mut *tx)
            .await
            .context("loading order items")?;

    let asset_ids: Vec<i64> = lines.iter().map(|&(id, _)| id).collect();
    let settlements: Vec<Settlement> = lines
        .iter()
        .map(|&(_, cents)| Settlement::new(f64::from(cents) / 100.0, DEFAULT_FEE_RATE))
        .collect();

    if status != "pending" {
        tx.commit().await.context("committing")?;
        return Ok(PaidOrder {
            order_id,
            asset_ids,
            settlements,
            already_paid: true,
        });
    }

    sqlx::query("UPDATE orders SET status = 'paid', paid_at = now() WHERE id = $1")
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .context("marking order paid")?;

    for &(asset_id, cents) in &lines {
        sqlx::query(
            r"INSERT INTO sales (asset_id, price_usd, fee_rate, order_id)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (order_id, asset_id) WHERE order_id IS NOT NULL DO NOTHING",
        )
        .bind(asset_id)
        .bind(f64::from(cents) / 100.0)
        .bind(DEFAULT_FEE_RATE)
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .context("recording sale for order")?;
    }

    tx.commit().await.context("committing payment")?;

    Ok(PaidOrder {
        order_id,
        asset_ids,
        settlements,
        already_paid: false,
    })
}

/// 내 주문 목록.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list_orders(pool: &PgPool, account_id: i64) -> RepoResult<Vec<Order>> {
    /* 줄을 한 번에 가져와 머리에 붙인다.

    주문마다 따로 물으면 100 건이 101 번의 왕복이 된다. 정렬은 SQL 이
    끝내 놓아서 여기서는 담기만 한다. */
    let rows = sqlx::query_as::<_, (i64, i32, String, String, i64, String, i32)>(
        r"SELECT o.id, o.amount_cents, o.currency, o.status,
                 i.asset_id, a.title, i.amount_cents
          FROM orders o
          JOIN order_items i ON i.order_id = o.id
          JOIN assets a      ON a.id = i.asset_id
          WHERE o.account_id = $1
          ORDER BY o.created_at DESC, o.id DESC, i.id",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .context("listing orders")?;

    let mut orders: Vec<Order> = Vec::new();
    for (id, total, currency, status, asset_id, title, cents) in rows {
        if orders.last().is_none_or(|o| o.id != id) {
            orders.push(Order {
                id,
                items: Vec::new(),
                amount_cents: total,
                currency,
                status,
            });
        }
        if let Some(last) = orders.last_mut() {
            last.items.push(OrderItem {
                asset_id,
                title,
                amount_cents: cents,
            });
        }
    }
    orders.truncate(100);
    Ok(orders)
}

/// 내 라이브러리 한 줄. 산 에셋과 언제 샀는지.
#[derive(Debug, Serialize)]
pub struct OwnedAsset {
    pub asset_id: i64,
    pub title: String,
    pub creator: String,
    pub category: String,
    pub engine: String,
    pub art_style: String,
    pub badge: Option<String>,
    /// 산 값. 지금 가격이 아니라 그때 낸 값이다.
    pub paid_usd: f64,
    pub paid_at: chrono::DateTime<chrono::Utc>,
}

/* 내가 가진 에셋.

결제가 끝난 주문만 센다. pending 은 결제창을 열어 두고 안 낸 상태라
라이브러리에 뜨면 안 된다.

같은 에셋을 두 번 샀어도 한 줄이다 — 소유 목록이지 결제 내역이 아니다. */
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn my_library(pool: &PgPool, account_id: i64) -> RepoResult<Vec<OwnedAsset>> {
    let rows = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            String,
            String,
            String,
            Option<String>,
            f64,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        r"SELECT a.id, a.title, c.display_name, a.category, a.engine, a.art_style,
                 r.badge,
                 (MIN(i.amount_cents)::double precision) / 100.0,
                 MIN(o.paid_at)
          FROM orders o
          JOIN order_items i ON i.order_id = o.id
          JOIN assets a      ON a.id = i.asset_id
          JOIN creators c    ON c.id = a.creator_id
          LEFT JOIN LATERAL (
              SELECT badge FROM reviews rv WHERE rv.asset_id = a.id
              ORDER BY rv.reviewed_at DESC, rv.id DESC LIMIT 1
          ) r ON TRUE
          WHERE o.account_id = $1 AND o.status = 'paid'
          GROUP BY a.id, a.title, c.display_name, a.category, a.engine, a.art_style, r.badge
          ORDER BY MIN(o.paid_at) DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .context("listing library")?;

    Ok(rows
        .into_iter()
        .map(
            |(asset_id, title, creator, category, engine, art_style, badge, paid_usd, paid_at)| {
                OwnedAsset {
                    asset_id,
                    title,
                    creator,
                    category,
                    engine,
                    art_style,
                    badge,
                    paid_usd,
                    paid_at,
                }
            },
        )
        .collect())
}

/* 이 계정이 이 에셋을 쓸 수 있는가.

산 사람과 만든 사람이다. 만든 사람을 빼면 자기가 올린 걸 자기가 못 받는
상황이 되는데, 그건 규칙이 아니라 사고다. */
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn owns_asset(pool: &PgPool, account_id: i64, asset_id: i64) -> RepoResult<bool> {
    let owns: bool = sqlx::query_scalar(OWNS_SQL)
        .bind(account_id)
        .bind(asset_id)
        .fetch_one(pool)
        .await
        .context("checking ownership")?;
    Ok(owns)
}

/// 주문을 여는 도중에 쓰는 같은 질문. 열려 있는 트랜잭션 안에서 봐야
/// 같은 요청으로 두 번 담긴 것이 둘 다 통과하는 일이 없다.
async fn owned_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    account_id: i64,
    asset_id: i64,
) -> RepoResult<bool> {
    let owns: bool = sqlx::query_scalar(OWNS_SQL)
        .bind(account_id)
        .bind(asset_id)
        .fetch_one(&mut **tx)
        .await
        .context("checking ownership")?;
    Ok(owns)
}

/// $1 계정  $2 에셋. 두 자리에서 같은 질문을 하므로 문장을 한 곳에 둔다.
const OWNS_SQL: &str = r"SELECT EXISTS (
        SELECT 1 FROM orders o
        JOIN order_items i ON i.order_id = o.id
        WHERE o.account_id = $1 AND i.asset_id = $2 AND o.status = 'paid'
    ) OR EXISTS (
        SELECT 1 FROM assets a JOIN creators c ON c.id = a.creator_id
        WHERE a.id = $2 AND c.account_id = $1
    )";
