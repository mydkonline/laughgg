//! 저장소 — Postgres 연결과 질의.
//!
//! 도메인 규칙은 여기 없다. 여기가 아는 건 "어떻게 꺼내고 어떻게 넣는가" 뿐이고,
//! 판정은 전부 [`crate::domain`] 이 한다. 테이블이 늘면 파일이 늘지 함수가
//! 길어지지 않도록 도메인별로 나눠 둔다.
//!
//! Postgres 에는 부호 없는 정수가 없다. `MySQL` 의 `BIGINT UNSIGNED` 가 하던 일을
//! `BIGINT` + `CHECK` 가 대신하므로, Rust 쪽 식별자는 전부 `i64` 다.

mod account;
mod asset;
mod download;
mod error;
mod game;
mod metrics;
mod order;
mod sale;

use anyhow::{Context as _, Result};
use sqlx::{PgPool, postgres::PgPoolOptions};

pub use account::{
    Account, account_for_token, close_session, log_in, new_state_token, open_session,
    purge_expired_sessions, sign_up, upsert_external,
};
pub use asset::{
    AssetDetail, AssetFacets, AssetFile, AssetPage, AssetQuery, AssetRow, FileError, NewAsset,
    ReviewResult, asset_facets, create_asset, get_asset, list_assets, review_asset,
};
pub use download::{FileRef, Grant, grant_download, purge_expired_grants, redeem_download};
pub use error::{RepoError, RepoResult};
pub use game::{Facet, Facets, GamePage, GameQuery, GameRow, game_facets, list_games};
pub use metrics::{Metrics, metrics};
pub use order::{
    Order, OwnedAsset, PaidOrder, attach_provider_ref, list_orders, mark_paid, my_library,
    open_order, owns_asset,
};
pub use sale::{NewSale, SaleResult, record_sale};

/// 커넥션 풀을 열고 마이그레이션을 적용한다.
///
/// # Errors
/// 연결 또는 마이그레이션에 실패하면 오류를 반환한다.
pub async fn connect(url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(url)
        .await
        .with_context(|| format!("connecting to postgres at {url}"))?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("applying migrations")?;
    Ok(pool)
}
