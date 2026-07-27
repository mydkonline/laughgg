//! 생성 작업 큐와 크레딧 원장.
//!
//! Redis 를 안 쓴다. Postgres 의 `FOR UPDATE SKIP LOCKED` 로 충분하고,
//! 무엇보다 크레딧 차감과 작업 등록이 한 트랜잭션에 들어간다 — 나누면
//! "크레딧은 깎였는데 작업은 안 들어간" 상태가 생기고, 그걸 막으려면
//! 결국 보상 트랜잭션을 짜야 한다.

use anyhow::Context as _;
use serde::Serialize;
use sqlx::PgPool;

use super::{RepoError, RepoResult};
use crate::domain::{GenRequest, MAX_ATTEMPTS, backoff_seconds};

#[derive(Debug, Serialize)]
pub struct Job {
    pub id: i64,
    pub status: String,
    pub prompt: String,
    pub art_style: String,
    pub provider: String,
    pub credits: i32,
    pub attempts: i16,
    pub asset_id: Option<i64>,
    pub error: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
}

type JobRow = (
    i64,
    String,
    String,
    String,
    String,
    i32,
    i16,
    Option<i64>,
    Option<String>,
    chrono::DateTime<chrono::Utc>,
    Option<chrono::DateTime<chrono::Utc>>,
);

fn to_job(r: JobRow) -> Job {
    Job {
        id: r.0,
        status: r.1,
        prompt: r.2,
        art_style: r.3,
        provider: r.4,
        credits: r.5,
        attempts: r.6,
        asset_id: r.7,
        error: r.8,
        created_at: r.9,
        finished_at: r.10,
    }
}

const COLUMNS: &str = "id, status, prompt, art_style, provider, credits, attempts,
                       asset_id, error, created_at, finished_at";

/// 지금 잔액. 원장의 합이다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn balance(pool: &PgPool, account_id: i64) -> RepoResult<i32> {
    let sum: Option<i64> =
        sqlx::query_scalar("SELECT SUM(delta)::bigint FROM credit_ledger WHERE account_id = $1")
            .bind(account_id)
            .fetch_one(pool)
            .await
            .context("reading credit balance")?;
    Ok(i32::try_from(sum.unwrap_or(0)).unwrap_or(i32::MAX))
}

/* 작업을 넣는다.

잔액 확인 → 차감 → 등록이 한 트랜잭션이다. 잔액을 읽을 때 계정 행을 잠근다 —
안 잠그면 같은 사람이 동시에 두 번 눌렀을 때 둘 다 잔액을 통과하고 둘 다
깎여서 음수가 된다. */
///
/// # Errors
/// 요청이 규칙을 어겼거나 잔액이 모자라면 오류를 반환한다.
pub async fn enqueue(pool: &PgPool, account_id: i64, req: &GenRequest) -> RepoResult<Job> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    // 계정 행을 잠근다. 원장에는 잠글 행이 없을 수도 있어서(첫 사용)
    // 계정 쪽을 잡는다.
    sqlx::query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE")
        .bind(account_id)
        .fetch_optional(&mut *tx)
        .await
        .context("locking account")?
        .ok_or(RepoError::Unauthenticated)?;

    let sum: Option<i64> =
        sqlx::query_scalar("SELECT SUM(delta)::bigint FROM credit_ledger WHERE account_id = $1")
            .bind(account_id)
            .fetch_one(&mut *tx)
            .await
            .context("reading balance")?;
    let have = i32::try_from(sum.unwrap_or(0)).unwrap_or(i32::MAX);

    let spec = req.validate(have)?;

    let row: JobRow = sqlx::query_as(&format!(
        "INSERT INTO gen_jobs (account_id, prompt, art_style, credits)
         VALUES ($1, $2, $3, $4) RETURNING {COLUMNS}"
    ))
    .bind(account_id)
    .bind(req.clean_prompt())
    .bind(spec.art_style.as_str())
    .bind(spec.credits)
    .fetch_one(&mut *tx)
    .await
    .context("enqueueing job")?;

    // 먼저 깎는다. 끝나고 깎으면 큐에 쌓아 놓고 도망갈 수 있다.
    sqlx::query(
        "INSERT INTO credit_ledger (account_id, delta, reason, job_id)
         VALUES ($1, $2, 'generation', $3)",
    )
    .bind(account_id)
    .bind(-spec.credits)
    .bind(row.0)
    .execute(&mut *tx)
    .await
    .context("charging credits")?;

    tx.commit().await.context("committing enqueue")?;
    Ok(to_job(row))
}

/* 작업 하나를 집는다.

SKIP LOCKED 가 핵심이다. 이게 없으면 워커들이 같은 행에서 줄을 서고,
워커를 늘려도 처리량이 안 는다. 더 나쁜 건 잠금 없이 짰을 때인데,
그러면 둘이 같은 작업을 집어서 제공자에 두 번 보내고 요금이 두 배로 나간다.
눈에는 안 보인다 — 결과가 하나만 남기 때문이다. */
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn claim(pool: &PgPool, worker_id: &str) -> RepoResult<Option<Job>> {
    let row: Option<JobRow> = sqlx::query_as(&format!(
        "UPDATE gen_jobs SET status = 'running', started_at = now(),
                             worker_id = $1, attempts = attempts + 1
         WHERE id = (
             SELECT id FROM gen_jobs
             WHERE status = 'queued' AND run_after <= now()
             ORDER BY priority DESC, id
             FOR UPDATE SKIP LOCKED
             LIMIT 1
         )
         RETURNING {COLUMNS}"
    ))
    .bind(worker_id)
    .fetch_optional(pool)
    .await
    .context("claiming job")?;

    Ok(row.map(to_job))
}

/// 제공자가 준 작업 id 를 붙인다. 폴링할 때 쓴다.
///
/// # Errors
/// 쓰기에 실패하면 오류를 반환한다.
pub async fn attach_job_ref(pool: &PgPool, job_id: i64, provider_ref: &str) -> RepoResult<()> {
    sqlx::query("UPDATE gen_jobs SET provider_ref = $2 WHERE id = $1")
        .bind(job_id)
        .bind(provider_ref)
        .execute(pool)
        .await
        .context("attaching provider ref")?;
    Ok(())
}

/// 끝났다. 만들어진 에셋을 붙인다.
///
/// # Errors
/// 쓰기에 실패하면 오류를 반환한다.
pub async fn finish(pool: &PgPool, job_id: i64, asset_id: i64) -> RepoResult<()> {
    sqlx::query(
        "UPDATE gen_jobs SET status = 'done', asset_id = $2, finished_at = now()
         WHERE id = $1 AND status = 'running'",
    )
    .bind(job_id)
    .bind(asset_id)
    .execute(pool)
    .await
    .context("finishing job")?;
    Ok(())
}

/* 실패했다.

재시도가 남아 있으면 큐로 되돌리고 다음 시도를 미룬다. 다 썼으면 실패로
확정하고 크레딧을 돌려준다 — 우리 잘못이나 제공자 잘못으로 실패한 걸
사용자가 물면 안 된다.

환불은 한 번만 한다. 같은 작업에 (job_id, 'refund') 유일 인덱스가 걸려 있어
두 번째는 조용히 무시된다. 콜백은 여러 번 온다. */
///
/// # Errors
/// 쓰기에 실패하면 오류를 반환한다.
pub async fn fail(pool: &PgPool, job_id: i64, error: &str) -> RepoResult<bool> {
    let mut tx = pool.begin().await.context("starting transaction")?;

    let row: Option<(i64, i16, i32)> = sqlx::query_as(
        "SELECT account_id, attempts, credits FROM gen_jobs WHERE id = $1 FOR UPDATE",
    )
    .bind(job_id)
    .fetch_optional(&mut *tx)
    .await
    .context("loading job to fail")?;

    let Some((account_id, attempts, credits)) = row else {
        tx.commit().await.context("committing")?;
        return Ok(false);
    };

    // 길면 자른다. 제공자 오류가 스택 트레이스째 오는 경우가 있다.
    let short: String = error.chars().take(300).collect();

    if attempts < MAX_ATTEMPTS {
        sqlx::query(
            "UPDATE gen_jobs SET status = 'queued', worker_id = NULL, error = $2,
                                 run_after = now() + make_interval(secs => $3)
             WHERE id = $1",
        )
        .bind(job_id)
        .bind(&short)
        // make_interval 은 double 을 받는다. 초 단위 지연이라 정밀도가 문제될 값이 아니다.
        .bind(f64::from(
            i32::try_from(backoff_seconds(attempts)).unwrap_or(600),
        ))
        .execute(&mut *tx)
        .await
        .context("requeueing job")?;
        tx.commit().await.context("committing requeue")?;
        return Ok(true);
    }

    sqlx::query(
        "UPDATE gen_jobs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1",
    )
    .bind(job_id)
    .bind(&short)
    .execute(&mut *tx)
    .await
    .context("failing job")?;

    sqlx::query(
        "INSERT INTO credit_ledger (account_id, delta, reason, job_id)
         VALUES ($1, $2, 'refund', $3)
         ON CONFLICT (job_id, reason) WHERE job_id IS NOT NULL DO NOTHING",
    )
    .bind(account_id)
    .bind(credits)
    .bind(job_id)
    .execute(&mut *tx)
    .await
    .context("refunding credits")?;

    tx.commit().await.context("committing failure")?;
    Ok(false)
}

/* 죽은 작업을 회수한다.

워커가 작업을 잡은 채로 죽으면 그 작업은 running 에 영원히 남는다.
우아한 종료를 붙여도 프로세스가 강제로 죽는 경우는 있다.

리더만 부른다. 여럿이 동시에 하면 서로 밟는다. */
///
/// # Errors
/// 쓰기에 실패하면 오류를 반환한다.
pub async fn reap_stalled(pool: &PgPool, older_than_secs: i64) -> RepoResult<u64> {
    let done = sqlx::query(
        "UPDATE gen_jobs SET status = 'queued', worker_id = NULL
         WHERE status = 'running' AND started_at < now() - make_interval(secs => $1)",
    )
    .bind(f64::from(i32::try_from(older_than_secs).unwrap_or(1200)))
    .execute(pool)
    .await
    .context("reaping stalled jobs")?;
    Ok(done.rows_affected())
}

/// 내 작업 목록.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn list_jobs(pool: &PgPool, account_id: i64) -> RepoResult<Vec<Job>> {
    let rows = sqlx::query_as::<_, JobRow>(&format!(
        "SELECT {COLUMNS} FROM gen_jobs WHERE account_id = $1
         ORDER BY created_at DESC LIMIT 50"
    ))
    .bind(account_id)
    .fetch_all(pool)
    .await
    .context("listing jobs")?;
    Ok(rows.into_iter().map(to_job).collect())
}

/// 작업 하나. 남의 것은 못 본다.
///
/// # Errors
/// 작업이 없거나 남의 것이면 오류를 반환한다.
pub async fn get_job(pool: &PgPool, account_id: i64, job_id: i64) -> RepoResult<Job> {
    let row: Option<JobRow> = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM gen_jobs WHERE id = $1 AND account_id = $2"
    ))
    .bind(job_id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .context("loading job")?;

    // 남의 작업을 "권한 없음" 으로 알려 주면 그게 곧 남의 작업 목록이다.
    row.map(to_job).ok_or(RepoError::JobNotFound(job_id))
}

/// 대기 중인 작업 수. 관측용이다 — 이게 계속 늘면 워커를 늘려야 한다.
///
/// # Errors
/// 조회에 실패하면 오류를 반환한다.
pub async fn queued_count(pool: &PgPool) -> RepoResult<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM gen_jobs WHERE status = 'queued'")
        .fetch_one(pool)
        .await
        .context("counting queued jobs")
        .map_err(Into::into)
}

/* 리더인가.

정리 작업(만료 세션, 만료 허가, 죽은 작업 회수)은 혼자만 해야 한다.
여럿이 하면 중복 처리되거나 서로 밟는다.

트랜잭션 레벨 락을 쓴다. 세션 레벨은 워커가 죽으면 락이 남아서, 다음
리더가 영영 안 뽑힌다. 별도 조정 서비스(etcd, Consul)를 안 넣는 이유는
Postgres 가 이미 이걸 해 주기 때문이다. */
pub const LEADER_LOCK: i64 = 0x1a_46_47_47; // "LaGG"

/// 리더 락을 잡고 무언가를 한다. 못 잡으면 아무것도 안 하고 false 를 낸다.
///
/// # Errors
/// 락 조회나 작업에 실패하면 오류를 반환한다.
pub async fn with_leader_lock<F, Fut>(pool: &PgPool, work: F) -> RepoResult<bool>
where
    F: FnOnce(sqlx::PgPool) -> Fut,
    Fut: Future<Output = RepoResult<()>>,
{
    let mut tx = pool.begin().await.context("starting transaction")?;
    let got: bool = sqlx::query_scalar("SELECT pg_try_advisory_xact_lock($1)")
        .bind(LEADER_LOCK)
        .fetch_one(&mut *tx)
        .await
        .context("taking leader lock")?;

    if !got {
        tx.commit().await.context("releasing")?;
        return Ok(false);
    }

    work(pool.clone()).await?;
    // 커밋과 함께 락이 풀린다. 명시적으로 풀 필요가 없다.
    tx.commit().await.context("committing leader work")?;
    Ok(true)
}
