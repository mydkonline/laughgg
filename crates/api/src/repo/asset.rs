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

#[derive(Debug, Default, Deserialize)]
pub struct AssetQuery {
    /// 제목이나 창작자 이름에 들어가는 말.
    pub q: Option<String>,
    pub category: Option<String>,
    pub engine: Option<String>,
    pub art_style: Option<String>,
    pub badge: Option<String>,
    pub min_score: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/* 조건절을 한 곳에서만 쓴다.

목록과 패싯이 다른 조건으로 돌면 "37개" 라고 써 놓고 12줄만 나온다.
게임 쪽에서 이미 같은 이유로 묶어 뒀다.

$1 검색어  $2 분류  $3 엔진  $4 화풍  $5 배지  $6 최소 점수 */
const FROM_WHERE: &str = r"
    FROM assets a
    JOIN creators c ON c.id = a.creator_id
    LEFT JOIN LATERAL (
        SELECT total, badge FROM reviews rv
        WHERE rv.asset_id = a.id
        ORDER BY rv.reviewed_at DESC, rv.id DESC
        LIMIT 1
    ) r ON TRUE
    WHERE ($1::text IS NULL OR a.title ILIKE '%' || $1 || '%' OR c.display_name ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR a.category = $2)
      AND ($3::text IS NULL OR a.engine = $3 OR a.engine = 'any')
      AND ($4::text IS NULL OR a.art_style = $4)
      AND ($5::text IS NULL OR r.badge = $5)
      AND COALESCE(r.total, 0) >= $6
";

/// DB 에서 오는 목록 행.
type ListRow = (
    i64,
    String,
    String,
    String,
    String,
    String,
    f64,
    Option<i16>,
    Option<String>,
);

/// 목록 한 쪽과 전체 건수. 건수가 없으면 쪽 번호를 못 그린다.
#[derive(Debug, Serialize)]
pub struct AssetPage {
    pub total: i64,
    pub assets: Vec<AssetRow>,
}

/* 에셋 목록 한 쪽.

정렬을 DB 에 맡긴다. 예전에는 다 받아 온 뒤 Rust 에서 배지 가중치로
다시 정렬했는데, 페이지를 나누는 순간 그게 안 된다 — 첫 쪽 안에서만
순서가 맞고 쪽을 넘기면 뒤섞인다. */
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn list_assets(pool: &PgPool, q: &AssetQuery) -> RepoResult<AssetPage> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);
    let min_score = i16::try_from(q.min_score.unwrap_or(0).clamp(0, 100)).unwrap_or(0);

    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) {FROM_WHERE}"))
        .bind(q.q.as_deref())
        .bind(q.category.as_deref())
        .bind(q.engine.as_deref())
        .bind(q.art_style.as_deref())
        .bind(q.badge.as_deref())
        .bind(min_score)
        .fetch_one(pool)
        .await
        .context("counting assets")?;

    // 배지가 노출 순위를 정한다 — 같은 점수라도 상위 배지가 먼저 보인다.
    // 가중치를 SQL 안에 두면 쪽을 넘겨도 순서가 유지된다.
    let rows = sqlx::query_as::<_, ListRow>(&format!(
        r"SELECT a.id, a.title, c.display_name, a.category, a.engine, a.art_style,
                 a.price_usd::double precision, r.total, r.badge
          {FROM_WHERE}
          ORDER BY CASE r.badge
                     WHEN 'challenger' THEN 8
                     WHEN 'diamond'    THEN 4
                     WHEN 'platinum'   THEN 2
                     WHEN 'silver'     THEN 1
                     ELSE 0
                   END DESC,
                   COALESCE(r.total, 0) DESC, a.id DESC
          LIMIT $7 OFFSET $8"
    ))
    .bind(q.q.as_deref())
    .bind(q.category.as_deref())
    .bind(q.engine.as_deref())
    .bind(q.art_style.as_deref())
    .bind(q.badge.as_deref())
    .bind(min_score)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .context("listing assets")?;

    let assets = rows
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

    Ok(AssetPage { total, assets })
}

/// 에셋 하나. 목록에 없는 것까지 보여 준다 — 상세 화면이 쓰는 값이다.
///
/// # Errors
/// 에셋이 없거나 조회에 실패하면 오류를 반환한다.
pub async fn get_asset(pool: &PgPool, asset_id: i64) -> RepoResult<AssetDetail> {
    let row: Option<DetailRow> = sqlx::query_as(
        r"SELECT a.id, a.title, c.display_name, a.category, a.engine, a.art_style,
                 a.price_usd::double precision, r.total, r.badge,
                 CASE WHEN r.total IS NULL THEN NULL ELSE jsonb_build_object(
                   'mesh_integrity',  r.mesh_integrity,
                   'texture_quality', r.texture_quality,
                   'lod_setup',       r.lod_setup,
                   'runtime_cost',    r.runtime_cost,
                   'license_clean',   r.license_clean,
                   'code_quality',    r.code_quality,
                   'integration',     r.integration
                 ) END,
                 (SELECT COUNT(*) FROM sales s WHERE s.asset_id = a.id)
          FROM assets a
          JOIN creators c ON c.id = a.creator_id
          LEFT JOIN LATERAL (
              SELECT * FROM reviews rv WHERE rv.asset_id = a.id
              ORDER BY rv.reviewed_at DESC, rv.id DESC LIMIT 1
          ) r ON TRUE
          WHERE a.id = $1",
    )
    .bind(asset_id)
    .fetch_optional(pool)
    .await
    .context("loading asset")?;

    let (id, title, creator, category, engine, art_style, price_usd, total, badge, scores, sold) =
        row.ok_or(RepoError::AssetNotFound(asset_id))?;

    Ok(AssetDetail {
        row: AssetRow {
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
        scores,
        sold,
    })
}

/* DB 에서 오는 상세 행.

컬럼이 열한 개라 익명 튜플로 두면 무엇이 무엇인지 호출부에서만 알 수 있다.
이름을 붙여 두면 SELECT 순서가 바뀌었을 때 컴파일러가 잡아 준다. */
type DetailRow = (
    i64,
    String,
    String,
    String,
    String,
    String,
    f64,
    Option<i16>,
    Option<String>,
    Option<serde_json::Value>,
    i64,
);

/// 상세 화면이 쓰는 값. 목록에 없는 항목별 점수와 판매 수가 붙는다.
#[derive(Debug, Serialize)]
pub struct AssetDetail {
    #[serde(flatten)]
    pub row: AssetRow,
    /// 항목별 점수. 검수 전이면 없다.
    pub scores: Option<serde_json::Value>,
    pub sold: i64,
}

/// 축 하나의 선택지와 각 개수.
#[derive(Debug, Serialize)]
pub struct AssetFacets {
    pub category: Vec<super::Facet>,
    pub engine: Vec<super::Facet>,
    pub art_style: Vec<super::Facet>,
    pub badge: Vec<super::Facet>,
}

/// 자기 축이면 조건을 안 건다. 그 축의 선택지를 전부 남기려는 것이다.
fn pick<'a>(axis: &str, skip: &str, v: Option<&'a str>) -> Option<&'a str> {
    if axis == skip { None } else { v }
}

/* 패싯 개수는 그 축을 뺀 나머지 조건으로 센다.

게임 쪽과 같은 규칙이다. 자기 축까지 좁히면 하나 고르는 순간 나머지가
0 이 되어 빠져나올 수가 없다. */
async fn asset_facet(
    pool: &PgPool,
    column: &str,
    q: &AssetQuery,
    skip: &str,
) -> RepoResult<Vec<super::Facet>> {
    let min_score = i16::try_from(q.min_score.unwrap_or(0).clamp(0, 100)).unwrap_or(0);
    let rows = sqlx::query_as::<_, (String, i64)>(&format!(
        "SELECT {column}::text AS value, COUNT(*) AS count {FROM_WHERE}
         AND {column} IS NOT NULL GROUP BY 1 ORDER BY count DESC, value"
    ))
    .bind(q.q.as_deref())
    .bind(pick("category", skip, q.category.as_deref()))
    .bind(pick("engine", skip, q.engine.as_deref()))
    .bind(pick("art_style", skip, q.art_style.as_deref()))
    .bind(pick("badge", skip, q.badge.as_deref()))
    .bind(min_score)
    .fetch_all(pool)
    .await
    .with_context(|| format!("counting asset facet {column}"))?;

    Ok(rows
        .into_iter()
        .map(|(value, count)| super::Facet { value, count })
        .collect())
}

/// 네 축의 선택지와 개수.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn asset_facets(pool: &PgPool, q: &AssetQuery) -> RepoResult<AssetFacets> {
    let (category, engine, art_style, badge) = tokio::try_join!(
        asset_facet(pool, "a.category", q, "category"),
        asset_facet(pool, "a.engine", q, "engine"),
        asset_facet(pool, "a.art_style", q, "art_style"),
        asset_facet(pool, "r.badge", q, "badge"),
    )?;

    Ok(AssetFacets {
        category,
        engine,
        art_style,
        badge,
    })
}

/* 등록 입력.

창작자를 받지 않는다. 로그인한 계정이 곧 창작자다 — 문자열로 받으면
남의 이름으로 올릴 수 있고, 그 이름이 정산 대상이 된다.

파일도 여기로 안 온다. 3D 모델은 수백 메가가 예사인데 그게 API 를 통과하면
요청 하나가 워커를 오래 잡고, 재시도하면 처음부터 다시 올라간다. 파일은
스토리지로 직접 올리고 여기에는 그 키만 붙인다. */
#[derive(Debug, Deserialize)]
pub struct NewAsset {
    pub title: String,
    pub category: String,
    pub engine: String,
    pub art_style: String,
    pub price_usd: f64,
    pub scores: ReviewScores,
    /// 올린 파일. 없으면 초안이고 팔 수 없다.
    #[serde(default, flatten)]
    pub file: Option<AssetFile>,
}

/// 스토리지에 올라간 파일.
#[derive(Debug, Clone, Deserialize)]
pub struct AssetFile {
    pub file_key: String,
    pub file_bytes: i64,
    /// 받는 쪽이 무결성을 확인할 값. 중간에 깨진 파일을 엔진에 넣으면
    /// 원인을 엉뚱한 데서 찾게 된다.
    pub file_sha256: String,
}

/// 파일이 규칙을 어긴 이유.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum FileError {
    #[error("file_key must not be empty")]
    EmptyKey,
    #[error("file_key must stay inside the uploads prefix")]
    BadKey,
    #[error("file_sha256 must be 64 hex characters")]
    BadDigest,
    #[error("file is too large: {bytes} bytes (max {max})")]
    TooLarge { bytes: i64, max: i64 },
}

/// 한 파일 상한. 이보다 크면 스토리지 요금과 다운로드 시간이 감당이 안 된다.
const MAX_FILE_BYTES: i64 = 2 * 1024 * 1024 * 1024;

impl AssetFile {
    /* 키를 그대로 믿지 않는다.

    클라이언트가 정하는 값이라 상위 경로나 남의 접두사를 적어 보낼 수 있다.
    스토리지에서 경로로 해석되면 남의 파일을 가리키게 된다. */
    ///
    /// # Errors
    /// 키나 해시가 규칙을 어기면 [`FileError`] 를 반환한다.
    pub fn validate(&self) -> Result<(), FileError> {
        let key = self.file_key.trim();
        if key.is_empty() {
            return Err(FileError::EmptyKey);
        }
        if !key.starts_with("uploads/")
            || key.contains("..")
            || key.contains('\\')
            || key.starts_with('/')
        {
            return Err(FileError::BadKey);
        }
        if self.file_sha256.len() != 64 || !self.file_sha256.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Err(FileError::BadDigest);
        }
        if self.file_bytes <= 0 || self.file_bytes > MAX_FILE_BYTES {
            return Err(FileError::TooLarge {
                bytes: self.file_bytes,
                max: MAX_FILE_BYTES,
            });
        }
        Ok(())
    }
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
pub async fn create_asset(
    pool: &PgPool,
    account_id: i64,
    input: &NewAsset,
) -> RepoResult<ReviewResult> {
    input.scores.validate()?;
    if let Some(file) = &input.file {
        file.validate()?;
    }

    let mut tx = pool.begin().await.context("starting transaction")?;

    // 이 계정의 창작자 프로필. 없으면 이 자리에서 만든다.
    // 핸들은 이메일 앞부분에서 뽑되 겹치면 계정 id 를 붙인다 — 사람이 고르게
    // 하려면 화면이 하나 더 필요하고, 지금 그게 없어서 등록이 막히면 안 된다.
    let creator_id = creator_for_account(&mut tx, account_id).await?;

    // MySQL 의 last_insert_id 대신 RETURNING 을 쓴다. 커넥션 상태에 기대지 않아
    // 트랜잭션 안에서 다른 문장이 끼어들어도 어긋나지 않는다.
    let asset_id: i64 = sqlx::query_scalar(
        r"INSERT INTO assets
            (creator_id, title, category, engine, price_usd, art_style,
             file_key, file_bytes, file_sha256)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id",
    )
    .bind(creator_id)
    .bind(&input.title)
    .bind(&input.category)
    .bind(&input.engine)
    .bind(input.price_usd)
    .bind(&input.art_style)
    .bind(input.file.as_ref().map(|f| f.file_key.trim()))
    .bind(input.file.as_ref().map(|f| f.file_bytes))
    .bind(input.file.as_ref().map(|f| f.file_sha256.to_lowercase()))
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

/* 계정의 창작자 프로필을 찾거나 만든다.

계정 하나에 창작자 하나다. 둘이면 정산이 어디로 갈지 정할 수 없다.
핸들이 겹치면 계정 id 를 붙인다 — 유일해야 하지만 사람이 볼 값은 아니라
여기서 자동으로 정해도 된다. */
async fn creator_for_account(
    tx: &mut Transaction<'_, Postgres>,
    account_id: i64,
) -> RepoResult<i64> {
    if let Some(id) = sqlx::query_scalar::<_, i64>("SELECT id FROM creators WHERE account_id = $1")
        .bind(account_id)
        .fetch_optional(&mut **tx)
        .await
        .context("looking up creator")?
    {
        return Ok(id);
    }

    let (email, display_name): (String, String) =
        sqlx::query_as("SELECT email, display_name FROM accounts WHERE id = $1")
            .bind(account_id)
            .fetch_one(&mut **tx)
            .await
            .context("loading account for creator profile")?;

    let base = email.split('@').next().unwrap_or("creator");
    let handle = sqlx::query_scalar::<_, String>(
        r"INSERT INTO creators (handle, display_name, account_id)
          VALUES (
            CASE WHEN EXISTS (SELECT 1 FROM creators WHERE handle = $1)
                 THEN $1 || '-' || $3::text ELSE $1 END,
            $2, $3)
          RETURNING handle",
    )
    .bind(base)
    .bind(&display_name)
    .bind(account_id)
    .fetch_one(&mut **tx)
    .await
    .context("creating creator profile")?;

    sqlx::query_scalar::<_, i64>("SELECT id FROM creators WHERE handle = $1")
        .bind(handle)
        .fetch_one(&mut **tx)
        .await
        .context("resolving new creator id")
        .map_err(Into::into)
}
