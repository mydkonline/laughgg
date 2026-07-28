//! 에셋 등록과 검수, 목록 조회.

use anyhow::Context as _;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Transaction};

use super::{RepoError, RepoResult};
use crate::domain::{Analysis, Badge, DEFAULT_FEE_RATE, Money, Origin, Settlement};

#[derive(Debug, Serialize)]
pub struct AssetRow {
    pub id: i64,
    pub title: String,
    pub creator: String,
    pub category: String,
    pub engine: String,
    pub art_style: String,
    /* 실제로 쓸 수 있는 엔진들. `engine` 은 필터가 쓰는 대표값이라
    두세 개를 지원해도 하나만 적혀 있다 — 사는 사람에게는 목록이 필요하다. */
    pub engines: Vec<String>,
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
    /* 특정 에셋들만. "1,2,3" 꼴로 온다.

    장바구니가 쓴다. 담긴 것이 열 점이면 상세를 열 번 부르는 대신
    한 번에 가져온다 — 열 번 부르면 화면이 열 번 나눠 그려진다. */
    pub ids: Option<String>,
    /* 어느 말로 볼 것인가.

    화면 문구는 앱이 옮기지만 창작자가 쓴 제목과 설명은 사용자 데이터라
    빌드 시점 표에 못 들어간다. 번역이 있으면 얹고 없으면 원문이 나간다 —
    비어 보이는 것보다 한국어가 나가는 게 낫다. */
    pub locale: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl AssetQuery {
    /// 쉼표로 나눈 id. 숫자가 아닌 건 버린다 — 거르지 않으면 SQL 이
    /// 통째로 실패해서 멀쩡한 줄까지 안 나온다.
    /// 앱이 아는 말만 받는다. 아무 문자열이나 받으면 인덱스를 못 탄다.
    fn wanted_locale(&self) -> Option<&str> {
        match self.locale.as_deref() {
            Some(l) if l != "ko" && !l.is_empty() => Some(l),
            _ => None,
        }
    }

    fn id_list(&self) -> Option<Vec<i64>> {
        let raw = self.ids.as_deref()?;
        let v: Vec<i64> = raw
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        if v.is_empty() { None } else { Some(v) }
    }
}

/* 조건절을 한 곳에서만 쓴다.

목록과 패싯이 다른 조건으로 돌면 "37개" 라고 써 놓고 12줄만 나온다.
게임 쪽에서 이미 같은 이유로 묶어 뒀다.

$1 검색어  $2 분류  $3 엔진  $4 화풍  $5 배지  $6 최소 점수  $7 id 목록  $8 언어 */
const FROM_WHERE: &str = r"
    FROM assets a
    JOIN creators c ON c.id = a.creator_id
    LEFT JOIN LATERAL (
        SELECT total, badge FROM reviews rv
        WHERE rv.asset_id = a.id
        ORDER BY rv.reviewed_at DESC, rv.id DESC
        LIMIT 1
    ) r ON TRUE
    /* 번역이 있으면 얹는다. 없으면 조인이 비고 COALESCE 가 원문으로
       떨어진다 — 안 옮긴 에셋이 목록에서 사라지면 안 된다. */
    LEFT JOIN asset_translations tr ON tr.asset_id = a.id AND tr.locale = $8
    WHERE ($1::text IS NULL OR a.title ILIKE '%' || $1 || '%' OR c.display_name ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR a.category = $2)
      AND ($3::text IS NULL OR a.engine = $3 OR a.engine = 'any')
      AND ($4::text IS NULL OR a.art_style = $4)
      AND ($5::text IS NULL OR r.badge = $5)
      AND COALESCE(r.total, 0) >= $6
      AND ($7::bigint[] IS NULL OR a.id = ANY($7))
";

/// DB 에서 오는 목록 행.
type ListRow = (
    i64,
    String,
    String,
    String,
    String,
    String,
    Vec<String>,
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

    let ids = q.id_list();
    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) {FROM_WHERE}"))
        .bind(q.q.as_deref())
        .bind(q.category.as_deref())
        .bind(q.engine.as_deref())
        .bind(q.art_style.as_deref())
        .bind(q.badge.as_deref())
        .bind(min_score)
        .bind(ids.as_deref())
        .bind(q.wanted_locale())
        .fetch_one(pool)
        .await
        .context("counting assets")?;

    // 배지가 노출 순위를 정한다 — 같은 점수라도 상위 배지가 먼저 보인다.
    // 가중치를 SQL 안에 두면 쪽을 넘겨도 순서가 유지된다.
    let rows = sqlx::query_as::<_, ListRow>(&format!(
        r"SELECT a.id, COALESCE(tr.title, a.title), c.display_name, a.category, a.engine,
                 a.art_style, a.engines, a.price_usd::double precision, r.total, r.badge
          {FROM_WHERE}
          ORDER BY CASE r.badge
                     WHEN 'challenger' THEN 8
                     WHEN 'diamond'    THEN 4
                     WHEN 'platinum'   THEN 2
                     WHEN 'silver'     THEN 1
                     ELSE 0
                   END DESC,
                   COALESCE(r.total, 0) DESC, a.id DESC
          LIMIT $9 OFFSET $10"
    ))
    .bind(q.q.as_deref())
    .bind(q.category.as_deref())
    .bind(q.engine.as_deref())
    .bind(q.art_style.as_deref())
    .bind(q.badge.as_deref())
    .bind(min_score)
    .bind(ids.as_deref())
    .bind(q.wanted_locale())
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .context("listing assets")?;

    let assets = rows
        .into_iter()
        .map(
            |(
                id,
                title,
                creator,
                category,
                engine,
                art_style,
                engines,
                price_usd,
                total,
                badge,
            )| {
                AssetRow {
                    id,
                    title,
                    creator,
                    category,
                    engine,
                    art_style,
                    engines,
                    price_usd,
                    total,
                    badge,
                }
            },
        )
        .collect();

    Ok(AssetPage { total, assets })
}

/// 에셋 하나. 목록에 없는 것까지 보여 준다 — 상세 화면이 쓰는 값이다.
///
/// # Errors
/// 에셋이 없거나 조회에 실패하면 오류를 반환한다.
pub async fn get_asset(
    pool: &PgPool,
    asset_id: i64,
    locale: Option<&str>,
) -> RepoResult<AssetDetail> {
    // 기본 언어는 조인할 게 없다. 빈 문자열을 넣으면 안 맞아서 조인이 빈다.
    let locale = locale.filter(|l| *l != "ko" && !l.is_empty());
    let row: Option<DetailRow> = sqlx::query_as(
        r"SELECT a.id, COALESCE(tr.title, a.title), c.display_name, a.category, a.engine,
                 a.art_style, a.engines, a.price_usd::double precision, r.total, r.badge,
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
          LEFT JOIN asset_translations tr ON tr.asset_id = a.id AND tr.locale = $2
          WHERE a.id = $1",
    )
    .bind(asset_id)
    .bind(locale)
    .fetch_optional(pool)
    .await
    .context("loading asset")?;

    let (
        id,
        title,
        creator,
        category,
        engine,
        art_style,
        engines,
        price_usd,
        total,
        badge,
        scores,
        sold,
    ) = row.ok_or(RepoError::AssetNotFound(asset_id))?;

    Ok(AssetDetail {
        row: AssetRow {
            id,
            title,
            creator,
            category,
            engine,
            art_style,
            engines,
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
    Vec<String>,
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
    .bind(q.id_list().as_deref())
    .bind(q.wanted_locale())
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
    /* 점수를 안 받는다.

    올리는 사람이 정하면 다들 100 을 놓고 챌린저를 받는다. 파일을 뜯어
    서버가 매긴다. 받는 건 출처 신고 하나인데, 그건 점수가 아니라
    나중에 감사할 수 있는 기록이다. */
    #[serde(default = "unknown_origin")]
    pub origin: String,
    /// 올린 파일. 없으면 초안이고 검수도 못 받는다.
    #[serde(default, flatten)]
    pub file: Option<AssetFile>,
}

fn unknown_origin() -> String {
    "unknown".to_owned()
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
/* 에셋을 등록한다. 배지는 아직 없다.

파일을 뜯어야 채점이 되는데 파일은 스토리지에 있다. 등록과 분석을 나누고,
분석 전까지는 배지가 없다 — 배지가 없으면 팔리지도 않는다. */
///
/// # Errors
/// 파일이나 출처가 규칙을 어겼거나 DB 쓰기에 실패하면 오류를 반환한다.
pub async fn create_asset(pool: &PgPool, account_id: i64, input: &NewAsset) -> RepoResult<i64> {
    let origin = Origin::from_label(&input.origin).unwrap_or(Origin::Unknown);
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
             file_key, file_bytes, file_sha256, origin)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    .bind(origin.as_str())
    .fetch_one(&mut *tx)
    .await
    .context("inserting asset")?;

    tx.commit().await.context("committing asset creation")?;

    /* 검수는 여기서 안 한다.

    파일을 뜯어야 채점이 되는데 파일은 스토리지에 있다. 등록은 끝내고
    분석은 따로 붙인다 — 그 전까지 이 에셋은 배지가 없고, 배지가 없으면
    팔리지도 않는다. 그게 맞다. 안 재고 배지를 주는 게 문제였다. */
    Ok(asset_id)
}

/* 분석에 쓸 파일 키와 출처를 소유권 확인과 함께 읽는다.

내 에셋만 채점한다 — 남의 것을 채점하면 배지를 남이 정하게 된다. 소유권과
값을 한 질의로 같이 읽어, 확인과 로딩 사이에 소유자가 바뀌는 창을 없앤다.
이 판정이 HTTP 핸들러에 raw SQL 로 흩어져 있던 걸 여기로 모은다 — 저장소
질의는 이 층의 일이다. */
///
/// # Errors
/// 내 에셋이 아니면 [`RepoError::Forbidden`]. 없는 에셋과 남의 에셋을 같은
/// 오류로 뭉갠다 — 갈라 주면 어느 id 가 실재하는지가 새어 나간다.
pub async fn analysis_inputs(
    pool: &PgPool,
    asset_id: i64,
    account_id: i64,
) -> RepoResult<(String, Origin)> {
    let row: Option<(Option<String>, String)> = sqlx::query_as(
        "SELECT a.file_key, a.origin
         FROM assets a JOIN creators c ON c.id = a.creator_id
         WHERE a.id = $1 AND c.account_id = $2",
    )
    .bind(asset_id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .context("loading asset for analysis")?;

    let (file_key, origin) = row.ok_or(RepoError::Forbidden)?;
    let origin = Origin::from_label(&origin).unwrap_or(Origin::Unknown);
    // file_key 가 없으면 확장자 판별용 이름만 없는 것이라 분석은 진행한다.
    Ok((file_key.unwrap_or_else(|| "unknown".into()), origin))
}

/* 분석 결과를 검수로 기록한다.

점수를 만드는 건 여기가 아니라 analyzer 다. 이 함수는 그 결과를 옮기기만
한다 — 옮기는 김에 고치면 화면에 뜬 점수와 저장된 점수가 갈린다. */
///
/// # Errors
/// 에셋이 없거나 쓰기에 실패하면 오류를 반환한다.
pub async fn record_analysis(
    pool: &PgPool,
    asset_id: i64,
    analysis: &Analysis,
    facts: &serde_json::Value,
) -> RepoResult<ReviewResult> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    let price_usd: f64 =
        sqlx::query_scalar("SELECT price_usd::double precision FROM assets WHERE id = $1")
            .bind(asset_id)
            .fetch_optional(&mut *tx)
            .await
            .context("loading asset")?
            .ok_or(RepoError::AssetNotFound(asset_id))?;

    let badge = if analysis.license_clean < 60 {
        Badge::Silver
    } else {
        Badge::from_score(analysis.total)
    };

    sqlx::query(
        r"INSERT INTO reviews
          (asset_id, mesh_integrity, texture_quality, lod_setup, runtime_cost,
           license_clean, code_quality, integration, total, badge, facts, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    )
    .bind(asset_id)
    .bind(i16::from(analysis.mesh_integrity))
    .bind(i16::from(analysis.texture_quality))
    .bind(i16::from(analysis.lod_setup))
    .bind(i16::from(analysis.runtime_cost))
    .bind(i16::from(analysis.license_clean))
    .bind(analysis.code_quality.map(i16::from))
    .bind(i16::from(analysis.integration))
    .bind(i16::from(analysis.total))
    .bind(badge.as_str())
    .bind(facts)
    .bind(serde_json::json!(analysis.notes))
    .execute(&mut *tx)
    .await
    .context("recording analysis")?;

    tx.commit().await.context("committing analysis")?;

    Ok(ReviewResult {
        asset_id,
        total: analysis.total,
        badge,
        production_ready: badge.production_ready(),
        license_blocked: analysis.license_clean < 60,
        settlement_preview: Settlement::new(Money::from_usd(price_usd), DEFAULT_FEE_RATE),
    })
}

/* 점수를 인자로 받는 검수 함수는 없다.

`review_asset(pool, id, scores)` 가 있었다. 등록에서 점수를 뺀 뒤에도 이
함수와 그 HTTP 경로가 남아 있어서, 결국 같은 자리로 들어올 수 있었다.
검수를 만드는 길은 [`record_analysis`] 하나다 — 그리고 그건 analyzer 가
잰 값만 받는다. */

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
