//! 게임별 엔진 조회와 패싯 집계.

use anyhow::Context as _;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use super::RepoResult;

#[derive(Debug, Serialize)]
pub struct GameRow {
    pub slug: String,
    pub name: String,
    pub developer: String,
    pub engine: String,
    pub engine_family: String,
    pub confirmed: bool,
    pub category: String,
    pub scale: String,
    pub year: i16,
    pub rank: Option<i32>,
    pub owners: Option<String>,
    pub positive: Option<i32>,
    /// 게임마다 항목 수가 다른 제작 스택. 컬럼으로 펴지 않는다.
    pub stack: serde_json::Value,
}

/// 목록을 좁히는 조건. 전부 선택이며 없으면 안 건다.
#[derive(Debug, Default, Deserialize)]
pub struct GameQuery {
    pub q: Option<String>,
    pub engine: Option<String>,
    pub category: Option<String>,
    pub scale: Option<String>,
    pub year_from: Option<i16>,
    pub year_to: Option<i16>,
    /// 제작 스택에 이 도구를 쓰는 게임만. JSONB 포함 연산이라 GIN 인덱스를 탄다.
    pub uses: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// 목록 한 쪽과 전체 건수. 건수를 같이 주지 않으면 쪽 번호를 못 그린다.
#[derive(Debug, Serialize)]
pub struct GamePage {
    pub total: i64,
    pub games: Vec<GameRow>,
}

/* 조건절을 한 곳에서만 쓴다.

목록과 패싯이 다른 조건으로 돌면 "37개" 라고 써 놓고 12줄만 나오는 일이
생긴다. 같은 문자열을 양쪽이 공유하게 두고, 파라미터 번호도 고정한다.

$1 이름  $2 엔진 계열  $3 분류  $4 규모  $5 연도 하한  $6 연도 상한  $7 스택 도구 */
const WHERE: &str = r"
    WHERE ($1::text     IS NULL OR name ILIKE '%' || $1 || '%')
      AND ($2::text     IS NULL OR engine_family = $2)
      AND ($3::text     IS NULL OR category = $3)
      AND ($4::text     IS NULL OR scale = $4)
      AND ($5::smallint IS NULL OR year >= $5)
      AND ($6::smallint IS NULL OR year <= $6)
      AND ($7::text     IS NULL OR stack @> jsonb_build_array(jsonb_build_object('name', $7)))
";

/// 게임 목록 한 쪽.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn list_games(pool: &PgPool, q: &GameQuery) -> RepoResult<GamePage> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);

    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM games {WHERE}"))
        .bind(q.q.as_deref())
        .bind(q.engine.as_deref())
        .bind(q.category.as_deref())
        .bind(q.scale.as_deref())
        .bind(q.year_from)
        .bind(q.year_to)
        .bind(q.uses.as_deref())
        .fetch_one(pool)
        .await
        .context("counting games")?;

    let games = sqlx::query_as::<_, GameRowDb>(&format!(
        r"SELECT slug, name, developer, engine, engine_family, confirmed, category, scale,
                 year, rank, owners, positive, stack
          FROM games {WHERE}
          ORDER BY rank NULLS LAST, year DESC, name
          LIMIT $8 OFFSET $9"
    ))
    .bind(q.q.as_deref())
    .bind(q.engine.as_deref())
    .bind(q.category.as_deref())
    .bind(q.scale.as_deref())
    .bind(q.year_from)
    .bind(q.year_to)
    .bind(q.uses.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .context("listing games")?;

    Ok(GamePage {
        total,
        games: games.into_iter().map(GameRowDb::into_row).collect(),
    })
}

/// 축 하나의 선택지와 각 개수.
#[derive(Debug, Serialize)]
pub struct Facet {
    pub value: String,
    pub count: i64,
}

#[derive(Debug, Default, Serialize)]
pub struct Facets {
    pub engine: Vec<Facet>,
    pub category: Vec<Facet>,
    pub scale: Vec<Facet>,
    pub year: Vec<Facet>,
}

/* 패싯 개수는 그 축을 뺀 나머지 조건으로 센다.

한 축을 고르는 순간 같은 축의 다른 선택지가 전부 0 이 되면 더 좁힐 수가
없다. 그래서 엔진 개수를 셀 때는 엔진 조건만 빼고 나머지를 건다.
프론트가 브라우저에서 하던 계산과 같은 규칙이다. */
async fn facet_of(
    pool: &PgPool,
    column: &str,
    q: &GameQuery,
    skip_engine: bool,
    skip_category: bool,
    skip_scale: bool,
) -> RepoResult<Vec<Facet>> {
    let sql = format!(
        r"SELECT {column}::text AS value, COUNT(*) AS count
          FROM games
          WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
            AND ($2::text IS NULL OR engine_family = $2)
            AND ($3::text IS NULL OR category = $3)
            AND ($4::text IS NULL OR scale = $4)
            AND ($5::smallint IS NULL OR year >= $5)
            AND ($6::smallint IS NULL OR year <= $6)
            AND ($7::text IS NULL OR stack @> jsonb_build_array(jsonb_build_object('name', $7)))
          GROUP BY 1
          ORDER BY count DESC, value"
    );

    let rows = sqlx::query_as::<_, (String, i64)>(&sql)
        .bind(q.q.as_deref())
        .bind(if skip_engine {
            None
        } else {
            q.engine.as_deref()
        })
        .bind(if skip_category {
            None
        } else {
            q.category.as_deref()
        })
        .bind(if skip_scale { None } else { q.scale.as_deref() })
        .bind(q.year_from)
        .bind(q.year_to)
        .bind(q.uses.as_deref())
        .fetch_all(pool)
        .await
        .with_context(|| format!("counting facet {column}"))?;

    Ok(rows
        .into_iter()
        .map(|(value, count)| Facet { value, count })
        .collect())
}

/// 네 축의 선택지와 개수.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn game_facets(pool: &PgPool, q: &GameQuery) -> RepoResult<Facets> {
    // 축마다 조건이 달라 한 문장으로 못 묶는다. 네 번은 동시에 던진다.
    let (engine, category, scale, year) = tokio::try_join!(
        facet_of(pool, "engine_family", q, true, false, false),
        facet_of(pool, "category", q, false, true, false),
        facet_of(pool, "scale", q, false, false, true),
        facet_of(pool, "year", q, false, false, false),
    )?;

    Ok(Facets {
        engine,
        category,
        scale,
        year,
    })
}

/// DB 행. `sqlx` 가 바로 채우고, 바깥에는 [`GameRow`] 로 나간다.
#[derive(sqlx::FromRow)]
struct GameRowDb {
    slug: String,
    name: String,
    developer: String,
    engine: String,
    engine_family: String,
    confirmed: bool,
    category: String,
    scale: String,
    year: i16,
    rank: Option<i32>,
    owners: Option<String>,
    positive: Option<i32>,
    stack: serde_json::Value,
}

impl GameRowDb {
    fn into_row(self) -> GameRow {
        GameRow {
            slug: self.slug,
            name: self.name,
            developer: self.developer,
            engine: self.engine,
            engine_family: self.engine_family,
            confirmed: self.confirmed,
            category: self.category,
            scale: self.scale,
            year: self.year,
            rank: self.rank,
            owners: self.owners,
            positive: self.positive,
            stack: self.stack,
        }
    }
}
