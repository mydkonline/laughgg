//! 다운로드 허가.

use anyhow::Context as _;
use serde::Serialize;
use sha2::{Digest as _, Sha256};
use sqlx::PgPool;

use super::{RepoError, RepoResult, new_state_token, owns_asset};

/// 허가 수명. 길면 허가가 아니라 공개 링크가 된다.
const GRANT_MINUTES: i64 = 15;

#[derive(Debug, Serialize)]
pub struct Grant {
    pub token: String,
    pub asset_id: i64,
    pub expires_in_seconds: i64,
}

/// DB 에서 오는 파일 행. 제목, 키, 크기, 해시.
type FileRow = (String, Option<String>, Option<i64>, Option<String>);

/// 받을 파일. 무결성 값이 있어야 받는 쪽이 깨진 파일을 알아챌 수 있다.
#[derive(Debug, Serialize)]
pub struct FileRef {
    pub asset_id: i64,
    pub title: String,
    pub file_key: String,
    pub file_bytes: Option<i64>,
    pub file_sha256: Option<String>,
}

/* 허가를 낸다.

가진 사람만 받는다. 산 사람과 만든 사람이다.
파일이 아직 안 올라온 에셋은 허가를 내도 받을 게 없으므로 그 자리에서 막는다. */
///
/// # Errors
/// 에셋이 없거나, 안 가졌거나, 파일이 없으면 오류를 반환한다.
pub async fn grant_download(pool: &PgPool, account_id: i64, asset_id: i64) -> RepoResult<Grant> {
    let file_key: Option<Option<String>> =
        sqlx::query_scalar("SELECT file_key FROM assets WHERE id = $1")
            .bind(asset_id)
            .fetch_optional(pool)
            .await
            .context("loading asset file")?;

    let file_key = file_key.ok_or(RepoError::AssetNotFound(asset_id))?;

    if !owns_asset(pool, account_id, asset_id).await? {
        return Err(RepoError::Forbidden);
    }
    if file_key.is_none() {
        return Err(RepoError::NoFile(asset_id));
    }

    let token = new_state_token()?;
    sqlx::query(
        r"INSERT INTO download_grants (token_hash, account_id, asset_id, expires_at)
          VALUES ($1, $2, $3, now() + make_interval(mins => $4))",
    )
    .bind(hash(&token))
    .bind(account_id)
    .bind(asset_id)
    .bind(i32::try_from(GRANT_MINUTES).unwrap_or(15))
    .execute(pool)
    .await
    .context("issuing download grant")?;

    Ok(Grant {
        token,
        asset_id,
        expires_in_seconds: GRANT_MINUTES * 60,
    })
}

/* 허가를 쓴다.

만료됐으면 없는 것으로 본다. 쓴 횟수를 센다 — 한 허가가 수천 번 쓰이면
링크가 샌 것이고, 그건 로그에서 보여야 한다.

허가를 확인하는 김에 소유를 다시 본다. 환불이나 계정 정리로 소유가
사라졌는데 발급해 둔 허가가 남아 있을 수 있다. */
///
/// # Errors
/// 허가가 없거나 만료됐거나 소유가 사라졌으면 오류를 반환한다.
pub async fn redeem_download(pool: &PgPool, token: &str) -> RepoResult<FileRef> {
    let row: Option<(i64, i64, i32)> = sqlx::query_as(
        r"UPDATE download_grants
          SET used_count = used_count + 1
          WHERE token_hash = $1 AND expires_at > now()
          RETURNING account_id, asset_id, used_count",
    )
    .bind(hash(token))
    .fetch_optional(pool)
    .await
    .context("redeeming grant")?;

    let (account_id, asset_id, used) = row.ok_or(RepoError::GrantNotFound)?;

    if used > 20 {
        tracing::warn!(
            asset_id,
            account_id,
            used,
            "a download grant is being used a lot; the link may have leaked"
        );
    }

    if !owns_asset(pool, account_id, asset_id).await? {
        return Err(RepoError::Forbidden);
    }

    let row: Option<FileRow> =
        sqlx::query_as("SELECT title, file_key, file_bytes, file_sha256 FROM assets WHERE id = $1")
            .bind(asset_id)
            .fetch_optional(pool)
            .await
            .context("loading file reference")?;

    let (title, file_key, file_bytes, file_sha256) =
        row.ok_or(RepoError::AssetNotFound(asset_id))?;
    let file_key = file_key.ok_or(RepoError::NoFile(asset_id))?;

    Ok(FileRef {
        asset_id,
        title,
        file_key,
        file_bytes,
        file_sha256,
    })
}

/// 만료된 허가를 치운다.
///
/// # Errors
/// 삭제에 실패하면 오류를 반환한다.
pub async fn purge_expired_grants(pool: &PgPool) -> RepoResult<u64> {
    let done = sqlx::query("DELETE FROM download_grants WHERE expires_at <= now()")
        .execute(pool)
        .await
        .context("purging grants")?;
    Ok(done.rows_affected())
}

/// 세션과 같은 이유로 해시만 저장한다.
fn hash(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}
