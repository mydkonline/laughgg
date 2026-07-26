//! 에셋 등록과 검수, 목록 조회.

use anyhow::Context as _;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Transaction};

use super::{RepoError, RepoResult};
use crate::domain::{Badge, DEFAULT_FEE_RATE, ReviewScores, Settlement};

#[derive(Debug, Serialize)]
pub struct AssetRow {
    pub id: i64,
    pub title: String,
    pub creator: String,
    pub category: String,
    pub engine: String,
    pub art_style: String,
    pub price_usd: f64,
    pub total: Option<i16>,
    pub badge: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetQuery {
    pub category: Option<String>,
    pub engine: Option<String>,
    pub min_score: Option<i64>,
    pub limit: Option<i64>,
}

/// 에셋 목록. 배지 노출 가중치와 점수 순으로 정렬한다.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn list_assets(pool: &PgPool, q: &AssetQuery) -> RepoResult<Vec<AssetRow>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let min_score = i16::try_from(q.min_score.unwrap_or(0).clamp(0, 100)).unwrap_or(0);

    let rows = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            String,
            String,
            String,
            f64,
            Option<i16>,
            Option<String>,
        ),
    >(
        r"
        SELECT a.id, a.title, c.display_name, a.category, a.engine, a.art_style,
               a.price_usd::double precision, r.total, r.badge
        FROM assets a
        JOIN creators c ON c.id = a.creator_id
        -- 검수는 여러 번 붙을 수 있다. 그냥 조인하면 에셋이 검수 건수만큼
        -- 복제되어 목록에 같은 상품이 여러 줄 뜬다. 최신 한 건만 가져온다.
        LEFT JOIN LATERAL (
            SELECT total, badge FROM reviews rv
            WHERE rv.asset_id = a.id
            ORDER BY rv.reviewed_at DESC, rv.id DESC
            LIMIT 1
        ) r ON TRUE
        WHERE ($1::text IS NULL OR a.category = $1)
          AND ($2::text IS NULL OR a.engine = $2 OR a.engine = 'any')
          AND COALESCE(r.total, 0) >= $3
        ORDER BY COALESCE(r.total, 0) DESC, a.id DESC
        LIMIT $4
        ",
    )
    .bind(q.category.as_deref())
    .bind(q.engine.as_deref())
    .bind(min_score)
    .bind(limit)
    .fetch_all(pool)
    .await
    .context("listing assets")?;

    let mut out: Vec<AssetRow> = rows
        .into_iter()
        .map(
            |(id, title, creator, category, engine, art_style, price_usd, total, badge)| AssetRow {
                id,
                title,
                creator,
                category,
                engine,
                art_style,
                price_usd,
                total,
                badge,
            },
        )
        .collect();

    // 배지가 노출 순위를 정한다 — 같은 점수라도 상위 배지가 먼저 보인다.
    out.sort_by(|a, b| {
        let key = |r: &AssetRow| {
            let w = r
                .badge
                .as_deref()
                .and_then(Badge::from_label)
                .map_or(0, Badge::exposure_weight);
            (w, r.total.unwrap_or(0))
        };
        key(b).cmp(&key(a))
    });
    Ok(out)
}

#[derive(Debug, Deserialize)]
pub struct NewAsset {
    pub creator_handle: String,
    pub title: String,
    pub category: String,
    pub engine: String,
    pub art_style: String,
    pub price_usd: f64,
    pub scores: ReviewScores,
}

#[derive(Debug, Serialize)]
pub struct ReviewResult {
    pub asset_id: i64,
    pub total: u8,
    pub badge: Badge,
    pub production_ready: bool,
    pub license_blocked: bool,
    pub settlement_preview: Settlement,
}

/// 에셋을 등록하고 즉시 검수 결과를 기록한다.
///
/// # Errors
/// 점수 범위가 잘못됐거나 DB 쓰기에 실패하면 오류를 반환한다.
pub async fn create_asset(pool: &PgPool, input: &NewAsset) -> RepoResult<ReviewResult> {
    input.scores.validate()?;

    let mut tx = pool.begin().await.context("starting transaction")?;

    // 같은 핸들이 이미 있으면 그대로 쓴다. RETURNING 이 아무것도 안 주는 경우가
    // 있어서 뒤이어 한 번 더 조회한다 — ON CONFLICT DO NOTHING 은 충돌 시 행을 안 낸다.
    sqlx::query(
        r"INSERT INTO creators (handle, display_name) VALUES ($1, $1)
          ON CONFLICT (handle) DO NOTHING",
    )
    .bind(&input.creator_handle)
    .execute(&mut *tx)
    .await
    .context("upserting creator")?;

    let creator_id: i64 = sqlx::query_scalar("SELECT id FROM creators WHERE handle = $1")
        .bind(&input.creator_handle)
        .fetch_one(&mut *tx)
        .await
        .context("resolving creator id")?;

    // MySQL 의 last_insert_id 대신 RETURNING 을 쓴다. 커넥션 상태에 기대지 않아
    // 트랜잭션 안에서 다른 문장이 끼어들어도 어긋나지 않는다.
    let asset_id: i64 = sqlx::query_scalar(
        r"INSERT INTO assets (creator_id, title, category, engine, price_usd, art_style)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id",
    )
    .bind(creator_id)
    .bind(&input.title)
    .bind(&input.category)
    .bind(&input.engine)
    .bind(input.price_usd)
    .bind(&input.art_style)
    .fetch_one(&mut *tx)
    .await
    .context("inserting asset")?;

    let result = record_review(&mut tx, asset_id, input.scores, input.price_usd).await?;
    tx.commit().await.context("committing asset creation")?;
    Ok(result)
}

/// 이미 등록된 에셋을 다시 채점한다.
///
/// 등록과 검수는 다른 일이다. 한때 두 경로가 같은 핸들러를 가리켜서 재검수를
/// 부르면 에셋이 하나 더 생겼다. 여기서는 존재하는 에셋에만 검수를 붙인다.
///
/// # Errors
/// 에셋이 없거나 점수 범위가 잘못됐거나 DB 쓰기에 실패하면 오류를 반환한다.
pub async fn review_asset(
    pool: &PgPool,
    asset_id: i64,
    scores: ReviewScores,
) -> RepoResult<ReviewResult> {
    scores.validate()?;

    let mut tx = pool.begin().await.context("starting transaction")?;

    let price_usd: f64 =
        sqlx::query_scalar("SELECT price_usd::double precision FROM assets WHERE id = $1")
            .bind(asset_id)
            .fetch_optional(&mut *tx)
            .await
            .context("loading asset for review")?
            .ok_or(RepoError::AssetNotFound(asset_id))?;

    let result = record_review(&mut tx, asset_id, scores, price_usd).await?;
    tx.commit().await.context("committing review")?;
    Ok(result)
}

/// 검수 한 건을 기록하고 판정을 돌려준다. 등록과 재검수가 같은 경로를 쓴다.
async fn record_review(
    tx: &mut Transaction<'_, Postgres>,
    asset_id: i64,
    scores: ReviewScores,
    price_usd: f64,
) -> RepoResult<ReviewResult> {
    let total = scores.total();
    let badge = scores.badge();

    sqlx::query(
        r"INSERT INTO reviews
          (asset_id, mesh_integrity, texture_quality, lod_setup, runtime_cost,
           license_clean, code_quality, integration, total, badge)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    )
    .bind(asset_id)
    .bind(i16::from(scores.mesh_integrity))
    .bind(i16::from(scores.texture_quality))
    .bind(i16::from(scores.lod_setup))
    .bind(i16::from(scores.runtime_cost))
    .bind(i16::from(scores.license_clean))
    .bind(i16::from(scores.code_quality))
    .bind(i16::from(scores.integration))
    .bind(i16::from(total))
    .bind(badge.as_str())
    .execute(&mut **tx)
    .await
    .context("inserting review")?;

    Ok(ReviewResult {
        asset_id,
        total,
        badge,
        production_ready: badge.production_ready(),
        license_blocked: scores.license_blocked(),
        settlement_preview: Settlement::new(price_usd, DEFAULT_FEE_RATE),
    })
}
