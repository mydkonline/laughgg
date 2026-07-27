//! 계정과 세션.

use anyhow::Context as _;
use argon2::{
    Argon2,
    password_hash::{
        PasswordHash, PasswordHasher as _, PasswordVerifier as _, SaltString, rand_core::OsRng,
    },
};
use rand::TryRngCore as _;
use serde::Serialize;
use sha2::{Digest as _, Sha256};
use sqlx::PgPool;

use super::{RepoError, RepoResult};
use crate::domain::Credentials;

/// 세션 수명. 짧으면 자주 로그인해야 하고 길면 훔친 쿠키가 오래 산다.
const SESSION_DAYS: i64 = 30;

#[derive(Debug, Clone, Serialize)]
pub struct Account {
    pub id: i64,
    pub email: String,
    pub display_name: String,
    /// 비밀번호를 걸어 둔 계정인가. 구글로만 들어온 계정은 false 다.
    pub has_password: bool,
}

/* 가입.

이메일이 이미 있으면 거절한다. 여기서 "이미 있다" 와 "비밀번호가 틀리다" 를
같은 말로 뭉개면 안 된다 — 가입 화면에서는 어느 쪽인지 알려 줘야 사람이
다음 행동을 정할 수 있다. 로그인 화면에서는 반대로 뭉갠다. */
///
/// # Errors
/// 입력이 규칙을 어겼거나 이메일이 이미 있으면 오류를 반환한다.
pub async fn sign_up(pool: &PgPool, creds: &Credentials) -> RepoResult<Account> {
    creds.validate()?;

    let hash = hash_password(&creds.password)?;
    let email = creds.email.trim();

    let row: Option<(i64,)> = sqlx::query_as(
        r"INSERT INTO accounts (email, display_name, password_hash)
          VALUES ($1, $2, $3)
          ON CONFLICT (lower(email)) DO NOTHING
          RETURNING id",
    )
    .bind(email)
    .bind(creds.name())
    .bind(&hash)
    .fetch_optional(pool)
    .await
    .context("inserting account")?;

    let id = row
        .ok_or_else(|| RepoError::EmailTaken(email.to_owned()))?
        .0;

    Ok(Account {
        id,
        email: email.to_owned(),
        display_name: creds.name().to_owned(),
        has_password: true,
    })
}

/* 로그인.

이메일이 없을 때와 비밀번호가 틀릴 때를 구분해서 알려 주면 그게 곧 계정
목록이 된다. 둘 다 같은 오류를 낸다.

없는 이메일이어도 해시 검증을 한 번 돌린다. 안 그러면 응답이 빨리 오는
것만으로 그 이메일이 없다는 걸 알 수 있다. */
///
/// # Errors
/// 이메일이나 비밀번호가 맞지 않으면 [`RepoError::BadCredentials`] 를 반환한다.
pub async fn log_in(pool: &PgPool, email: &str, password: &str) -> RepoResult<Account> {
    let found: Option<(i64, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, email, display_name, password_hash FROM accounts WHERE lower(email) = lower($1)",
    )
    .bind(email.trim())
    .fetch_optional(pool)
    .await
    .context("looking up account")?;

    let Some((id, email, display_name, Some(hash))) = found else {
        // 계정이 없거나 비밀번호가 안 걸린 계정(구글 전용)이다.
        // 둘 다 같은 시간을 쓰고 같은 오류를 낸다.
        burn_time(password);
        return Err(RepoError::BadCredentials);
    };

    verify_password(password, &hash)?;

    Ok(Account {
        id,
        email,
        display_name,
        has_password: true,
    })
}

/// 구글 같은 외부 신원으로 들어온 계정을 찾거나 만든다.
///
/// 이메일이 같으면 같은 사람으로 본다. 구글로 처음 들어온 뒤 비밀번호를
/// 걸어도, 반대로 비밀번호로 쓰던 사람이 구글로 들어와도 계정이 안 갈린다.
///
/// # Errors
/// 조회나 쓰기에 실패하면 오류를 반환한다.
pub async fn upsert_external(
    pool: &PgPool,
    provider: &str,
    subject: &str,
    email: &str,
    display_name: &str,
) -> RepoResult<Account> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    // 이미 이 신원으로 들어온 적이 있는가.
    let linked: Option<(i64, String, String, Option<String>)> = sqlx::query_as(
        r"SELECT a.id, a.email, a.display_name, a.password_hash
          FROM identities i JOIN accounts a ON a.id = i.account_id
          WHERE i.provider = $1 AND i.subject = $2",
    )
    .bind(provider)
    .bind(subject)
    .fetch_optional(&mut *tx)
    .await
    .context("looking up identity")?;

    if let Some((id, email, display_name, hash)) = linked {
        tx.commit().await.context("committing")?;
        return Ok(Account {
            id,
            email,
            display_name,
            has_password: hash.is_some(),
        });
    }

    // 처음 들어온 신원이다. 같은 이메일의 계정이 있으면 거기 붙인다.
    let account: (i64, String, String, Option<String>) = sqlx::query_as(
        r"INSERT INTO accounts (email, display_name, password_hash)
          VALUES ($1, $2, NULL)
          ON CONFLICT (lower(email)) DO UPDATE SET email = accounts.email
          RETURNING id, email, display_name, password_hash",
    )
    .bind(email.trim())
    .bind(display_name)
    .fetch_one(&mut *tx)
    .await
    .context("upserting account for external identity")?;

    sqlx::query(
        r"INSERT INTO identities (account_id, provider, subject) VALUES ($1, $2, $3)
          ON CONFLICT (provider, subject) DO NOTHING",
    )
    .bind(account.0)
    .bind(provider)
    .bind(subject)
    .execute(&mut *tx)
    .await
    .context("linking identity")?;

    tx.commit().await.context("committing external login")?;

    Ok(Account {
        id: account.0,
        email: account.1,
        display_name: account.2,
        has_password: account.3.is_some(),
    })
}

/// 세션을 연다. 돌려주는 토큰 원문은 이 순간 말고는 아무 데도 없다.
///
/// # Errors
/// 난수를 못 얻거나 쓰기에 실패하면 오류를 반환한다.
pub async fn open_session(pool: &PgPool, account_id: i64) -> RepoResult<String> {
    let token = new_token()?;
    sqlx::query(
        r"INSERT INTO sessions (token_hash, account_id, expires_at)
          VALUES ($1, $2, now() + make_interval(days => $3))",
    )
    .bind(hash_token(&token))
    .bind(account_id)
    .bind(i32::try_from(SESSION_DAYS).unwrap_or(30))
    .execute(pool)
    .await
    .context("opening session")?;
    Ok(token)
}

/// 토큰으로 계정을 찾는다. 만료된 세션은 없는 것으로 본다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn account_for_token(pool: &PgPool, token: &str) -> RepoResult<Option<Account>> {
    let row: Option<(i64, String, String, Option<String>)> = sqlx::query_as(
        r"SELECT a.id, a.email, a.display_name, a.password_hash
          FROM sessions s JOIN accounts a ON a.id = s.account_id
          WHERE s.token_hash = $1 AND s.expires_at > now()",
    )
    .bind(hash_token(token))
    .fetch_optional(pool)
    .await
    .context("resolving session")?;

    Ok(row.map(|(id, email, display_name, hash)| Account {
        id,
        email,
        display_name,
        has_password: hash.is_some(),
    }))
}

/// 세션을 닫는다. 없는 토큰이어도 조용히 성공한다 — 로그아웃은 멱등해야 한다.
///
/// # Errors
/// 삭제에 실패하면 오류를 반환한다.
pub async fn close_session(pool: &PgPool, token: &str) -> RepoResult<()> {
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
        .bind(hash_token(token))
        .execute(pool)
        .await
        .context("closing session")?;
    Ok(())
}

/// 만료된 세션을 치운다. 안 치우면 테이블이 영원히 자란다.
///
/// # Errors
/// 삭제에 실패하면 오류를 반환한다.
pub async fn purge_expired_sessions(pool: &PgPool) -> RepoResult<u64> {
    let done = sqlx::query("DELETE FROM sessions WHERE expires_at <= now()")
        .execute(pool)
        .await
        .context("purging sessions")?;
    Ok(done.rows_affected())
}

/// OAuth state 처럼 세션 밖에서도 쓰는 난수.
///
/// # Errors
/// 안전한 난수를 못 얻으면 오류를 반환한다.
pub fn new_state_token() -> RepoResult<String> {
    new_token()
}

/// 32바이트 난수를 16진수로. 추측이 불가능해야 세션이 세션이다.
fn new_token() -> RepoResult<String> {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng
        .try_fill_bytes(&mut bytes)
        .map_err(|e| RepoError::Other(anyhow::anyhow!("no secure randomness: {e}")))?;
    Ok(hex::encode(bytes))
}

/// 토큰은 해시로만 저장한다. DB 가 새도 그 자리에서 로그인이 되면 안 된다.
fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

fn hash_password(password: &str) -> RepoResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| RepoError::Other(anyhow::anyhow!("hashing password: {e}")))
}

fn verify_password(password: &str, hash: &str) -> RepoResult<()> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| RepoError::Other(anyhow::anyhow!("stored hash is unreadable: {e}")))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| RepoError::BadCredentials)
}

/* 계정이 없을 때도 해시를 한 번 돌린다.

없으면 즉시 돌아오고 있으면 수십 밀리초가 걸리면, 응답 시간만 재도 어느
이메일이 가입돼 있는지 알아낼 수 있다. */
fn burn_time(password: &str) {
    const DUMMY: &str = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$\
                         J8dS4ZGnvJcC9WQ4YkJ4tYqNKqEXqLhCqQzqvKQpQXo";
    if let Ok(parsed) = PasswordHash::new(DUMMY) {
        let _ = Argon2::default().verify_password(password.as_bytes(), &parsed);
    }
}
