//! 게임별 엔진 조회.

use anyhow::Context as _;
use serde::Serialize;
use sqlx::PgPool;

use super::RepoResult;

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
    pub year: i16,
}

/// 게임 스택 목록.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn list_games(pool: &PgPool, platform: Option<&str>) -> RepoResult<Vec<GameRow>> {
    // 같은 파라미터를 두 번 쓸 수 있어서 MySQL 처럼 두 번 바인딩하지 않는다.
    // 캐스팅을 붙여야 NULL 일 때 타입을 정할 수 있다.
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            bool,
            String,
            String,
            String,
            i16,
        ),
    >(
        r"SELECT slug, name, developer, engine, confirmed, dimension, platform, scale, year
          FROM games
          WHERE ($1::text IS NULL OR platform = $1)
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
                    confirmed,
                    dimension,
                    platform,
                    scale,
                    year,
                }
            },
        )
        .collect())
}
