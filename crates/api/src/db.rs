//! `SQLite` 연결과 조회.

use anyhow::{Context as _, Result};
use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

use crate::domain::{DEFAULT_FEE_RATE, Grade, ReviewScores, Settlement};

/// 커넥션 풀을 열고 마이그레이션을 적용한다.
///
/// # Errors
/// 연결 또는 마이그레이션에 실패하면 오류를 반환한다.
pub async fn connect(url: &str) -> Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect(url)
        .await
        .with_context(|| format!("opening sqlite database at {url}"))?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("applying migrations")?;
    Ok(pool)
}

#[derive(Debug, Serialize)]
pub struct AssetRow {
    pub id: i64,
    pub title: String,
    pub creator: String,
    pub category: String,
    pub engine: String,
    pub art_style: String,
    pub price_usd: f64,
    pub total: Option<i64>,
    pub grade: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetQuery {
    pub category: Option<String>,
    pub engine: Option<String>,
    pub min_score: Option<i64>,
    pub limit: Option<i64>,
}

/// 에셋 목록. 등급 노출 가중치와 점수 순으로 정렬한다.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn list_assets(pool: &SqlitePool, q: &AssetQuery) -> Result<Vec<AssetRow>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let min_score = q.min_score.unwrap_or(0);
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
            Option<i64>,
            Option<String>,
        ),
    >(
        r"
        SELECT a.id, a.title, c.display_name, a.category, a.engine, a.art_style, a.price_usd,
               r.total, r.grade
        FROM assets a
        JOIN creators c ON c.id = a.creator_id
        LEFT JOIN reviews r ON r.asset_id = a.id
        WHERE (?1 IS NULL OR a.category = ?1)
          AND (?2 IS NULL OR a.engine = ?2 OR a.engine = 'any')
          AND COALESCE(r.total, 0) >= ?3
        ORDER BY COALESCE(r.total, 0) DESC, a.id DESC
        LIMIT ?4
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
            |(id, title, creator, category, engine, art_style, price_usd, total, grade)| AssetRow {
                id,
                title,
                creator,
                category,
                engine,
                art_style,
                price_usd,
                total,
                grade,
            },
        )
        .collect();

    // 등급이 노출 순위를 정한다 — 같은 점수라도 상위 등급이 먼저 보인다.
    out.sort_by(|a, b| {
        let key = |r: &AssetRow| {
            let w = r
                .grade
                .as_deref()
                .and_then(Grade::from_label)
                .map_or(0, Grade::exposure_weight);
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
    pub grade: Grade,
    pub production_ready: bool,
    pub license_blocked: bool,
    pub settlement_preview: Settlement,
}

/// 에셋을 등록하고 즉시 검수 결과를 기록한다.
///
/// # Errors
/// 점수 범위가 잘못됐거나 DB 쓰기에 실패하면 오류를 반환한다.
pub async fn create_asset(pool: &SqlitePool, input: &NewAsset) -> Result<ReviewResult> {
    input
        .scores
        .validate()
        .context("validating review scores")?;

    let mut tx = pool.begin().await.context("starting transaction")?;

    sqlx::query("INSERT OR IGNORE INTO creators (handle, display_name) VALUES (?1, ?1)")
        .bind(&input.creator_handle)
        .execute(&mut *tx)
        .await
        .context("upserting creator")?;

    let creator_id: i64 = sqlx::query_scalar("SELECT id FROM creators WHERE handle = ?1")
        .bind(&input.creator_handle)
        .fetch_one(&mut *tx)
        .await
        .context("resolving creator id")?;

    let asset_id: i64 = sqlx::query_scalar(
        r"INSERT INTO assets (creator_id, title, category, engine, price_usd, art_style)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id",
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

    let s = input.scores;
    let total = s.total();
    let grade = s.grade();

    sqlx::query(
        r"INSERT INTO reviews
          (asset_id, mesh_integrity, texture_quality, lod_setup, runtime_cost,
           license_clean, code_quality, integration, total, grade)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
    )
    .bind(asset_id)
    .bind(i64::from(s.mesh_integrity))
    .bind(i64::from(s.texture_quality))
    .bind(i64::from(s.lod_setup))
    .bind(i64::from(s.runtime_cost))
    .bind(i64::from(s.license_clean))
    .bind(i64::from(s.code_quality))
    .bind(i64::from(s.integration))
    .bind(i64::from(total))
    .bind(grade.as_str())
    .execute(&mut *tx)
    .await
    .context("inserting review")?;

    tx.commit().await.context("committing asset creation")?;

    Ok(ReviewResult {
        asset_id,
        total,
        grade,
        production_ready: grade.production_ready(),
        license_blocked: s.license_blocked(),
        settlement_preview: Settlement::new(input.price_usd, DEFAULT_FEE_RATE),
    })
}

#[derive(Debug, Serialize)]
pub struct GameRow {
    pub slug: String,
    pub name: String,
    pub developer: String,
    pub engine: String,
    pub confirmed: bool,
    pub dimension: String,
    pub platform: String,
    pub scale: String,
    pub year: i64,
}

/// 게임 스택 목록.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn list_games(pool: &SqlitePool, platform: Option<&str>) -> Result<Vec<GameRow>> {
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            i64,
            String,
            String,
            String,
            i64,
        ),
    >(
        r"SELECT slug, name, developer, engine, confirmed, dimension, platform, scale, year
          FROM games
          WHERE (?1 IS NULL OR platform = ?1)
          ORDER BY year DESC, name",
    )
    .bind(platform)
    .fetch_all(pool)
    .await
    .context("listing games")?;

    Ok(rows
        .into_iter()
        .map(
            |(slug, name, developer, engine, confirmed, dimension, platform, scale, year)| {
                GameRow {
                    slug,
                    name,
                    developer,
                    engine,
                    confirmed: confirmed != 0,
                    dimension,
                    platform,
                    scale,
                    year,
                }
            },
        )
        .collect())
}

/// 대시보드용 집계. D안 수익 구조를 그대로 반영한다.
#[derive(Debug, Serialize)]
pub struct Metrics {
    pub assets: i64,
    pub creators: i64,
    pub reviewed: i64,
    pub rejected: i64,
    pub rejection_rate: f64,
    pub active_studios: i64,
    pub monthly_subscription_krw: i64,
    pub monthly_fee_usd: f64,
}

/// 마켓 지표를 집계한다.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn metrics(pool: &SqlitePool) -> Result<Metrics> {
    let assets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
        .fetch_one(pool)
        .await
        .context("counting assets")?;
    let creators: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM creators")
        .fetch_one(pool)
        .await
        .context("counting creators")?;
    let reviewed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reviews")
        .fetch_one(pool)
        .await
        .context("counting reviews")?;
    let rejected: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reviews WHERE grade = 'silver'")
        .fetch_one(pool)
        .await
        .context("counting rejections")?;
    let active_studios: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM studios WHERE active = 1")
        .fetch_one(pool)
        .await
        .context("counting studios")?;
    let monthly_subscription_krw: i64 =
        sqlx::query_scalar("SELECT COALESCE(SUM(monthly_krw), 0) FROM studios WHERE active = 1")
            .fetch_one(pool)
            .await
            .context("summing subscriptions")?;
    let monthly_fee_usd: f64 =
        sqlx::query_scalar("SELECT COALESCE(SUM(price_usd * fee_rate), 0.0) FROM sales")
            .fetch_one(pool)
            .await
            .context("summing fees")?;

    #[expect(
        clippy::cast_precision_loss,
        reason = "카운트 규모에서 f64 정밀도 손실은 표시용으로 무의미"
    )]
    let rejection_rate = if reviewed > 0 {
        (rejected as f64 / reviewed as f64 * 1000.0).round() / 10.0
    } else {
        0.0
    };

    Ok(Metrics {
        assets,
        creators,
        reviewed,
        rejected,
        rejection_rate,
        active_studios,
        monthly_subscription_krw,
        monthly_fee_usd,
    })
}
