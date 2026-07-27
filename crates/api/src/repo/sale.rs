//! 판매 기록.

use anyhow::Context as _;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use super::{RepoError, RepoResult};
use crate::domain::{Badge, DEFAULT_FEE_RATE, Settlement};

/// 판매 요청. 값은 여기 없다 — 가격은 에셋에서 읽고 수수료율은 서버가 정한다.
///
/// 클라이언트가 가격을 실어 보내면 같은 에셋이 요청마다 다른 값에 팔리고,
/// 수수료 합계가 무엇을 센 숫자인지 알 수 없게 된다.
#[derive(Debug, Default, Deserialize)]
pub struct NewSale {
    /// 구독 스튜디오가 샀다면 그 이름. 개인 구매면 비운다.
    pub studio: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SaleResult {
    pub sale_id: i64,
    pub asset_id: i64,
    pub badge: Badge,
    pub settlement: Settlement,
}

/* 판매 한 건을 기록한다.

검수를 통과하지 못한 에셋은 못 판다. 배지 실버는 노출 제외이고, 노출이
안 되는 물건이 팔렸다면 그건 우회 경로가 있다는 뜻이다. 도메인 규칙이
API 경계에서만 지켜지면 규칙이 아니라 권고가 된다.

수수료율은 지금 값을 행에 박아 둔다. 나중에 요율이 바뀌어도 지난 정산이
따라 움직이면 안 된다. */
///
/// # Errors
/// 에셋이 없거나, 검수를 안 받았거나, 배지가 판매 가능 등급이 아니거나,
/// 스튜디오 이름을 못 찾으면 오류를 반환한다.
pub async fn record_sale(pool: &PgPool, asset_id: i64, input: &NewSale) -> RepoResult<SaleResult> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    // 가격과 최신 배지를 한 번에 읽는다. 따로 읽으면 그 사이에 재검수가 끼어
    // 통과 배지로 값을 받고 실버 상태로 파는 일이 생긴다.
    let row: Option<(f64, Option<String>)> = sqlx::query_as(
        r"SELECT a.price_usd::double precision, r.badge
          FROM assets a
          LEFT JOIN LATERAL (
              SELECT badge FROM reviews rv
              WHERE rv.asset_id = a.id
              ORDER BY rv.reviewed_at DESC, rv.id DESC
              LIMIT 1
          ) r ON TRUE
          WHERE a.id = $1
          FOR UPDATE OF a",
    )
    .bind(asset_id)
    .fetch_optional(&mut *tx)
    .await
    .context("loading asset for sale")?;

    let (price_usd, badge_label) = row.ok_or(RepoError::AssetNotFound(asset_id))?;
    let label = badge_label.ok_or(RepoError::AssetNotReviewed(asset_id))?;
    let badge = Badge::from_label(&label).ok_or_else(|| {
        RepoError::Other(anyhow::anyhow!(
            "unknown badge {label:?} on asset {asset_id}"
        ))
    })?;

    if !badge.production_ready() {
        return Err(RepoError::AssetNotSellable {
            asset_id,
            badge: label,
        });
    }

    let studio_id = match input.studio.as_deref() {
        None => None,
        Some(name) => Some(
            sqlx::query_scalar::<_, i64>("SELECT id FROM studios WHERE name = $1")
                .bind(name)
                .fetch_optional(&mut *tx)
                .await
                .context("resolving studio")?
                .ok_or_else(|| RepoError::StudioNotFound(name.to_owned()))?,
        ),
    };

    let sale_id: i64 = sqlx::query_scalar(
        r"INSERT INTO sales (asset_id, studio_id, price_usd, fee_rate)
          VALUES ($1, $2, $3, $4)
          RETURNING id",
    )
    .bind(asset_id)
    .bind(studio_id)
    .bind(price_usd)
    .bind(DEFAULT_FEE_RATE)
    .fetch_one(&mut *tx)
    .await
    .context("inserting sale")?;

    tx.commit().await.context("committing sale")?;

    Ok(SaleResult {
        sale_id,
        asset_id,
        badge,
        settlement: Settlement::new(price_usd, DEFAULT_FEE_RATE),
    })
}
