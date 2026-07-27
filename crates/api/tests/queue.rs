//! 생성 작업 큐 통합 테스트.
//!
//! 여기서 제일 중요한 건 하나다 — **워커 둘이 같은 작업을 집으면 안 된다.**
//! 깨지면 제공자에 두 번 보내고 요금이 두 배로 나가는데, 결과가 하나만
//! 남아서 눈으로는 안 보인다. 청구서를 봐야 안다.

use laughgg_api::{
    domain::{Credentials, GenError, GenRequest},
    repo::{self, RepoError},
};
use sqlx::PgPool;

async fn an_account(pool: &PgPool, email: &str) -> i64 {
    repo::sign_up(
        pool,
        &Credentials {
            email: email.into(),
            password: "goodpassword".into(),
            display_name: None,
        },
    )
    .await
    .expect("가입")
    .id
}

/* 크레딧을 넣는다.

0010 마이그레이션의 가입 시드는 그 시점에 있던 계정만 채운다. 테스트에서
만드는 계정은 그 뒤에 생기므로 잔액이 0 에서 시작한다 — 실제 서비스에서
새 가입자에게 크레딧을 주려면 sign_up 안에서 원장에 넣어야 한다. */
async fn give(pool: &PgPool, account_id: i64, amount: i32) {
    sqlx::query("INSERT INTO credit_ledger (account_id, delta, reason) VALUES ($1, $2, 'grant')")
        .bind(account_id)
        .bind(amount)
        .execute(pool)
        .await
        .expect("크레딧 지급");
}

fn req(prompt: &str, quality: &str) -> GenRequest {
    GenRequest {
        prompt: prompt.into(),
        art_style: "stylized".into(),
        quality: quality.into(),
    }
}

#[sqlx::test]
async fn enqueueing_charges_credits_in_the_same_transaction(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    give(&pool, who, 100).await;
    let before = repo::balance(&pool, who).await.expect("잔액");

    let job = repo::enqueue(&pool, who, &req("고딕 석상", "standard"))
        .await
        .expect("등록");

    assert_eq!(job.status, "queued");
    assert_eq!(
        job.credits, 2,
        "standard 는 2크레딧. 제공자 단가에 비례한다"
    );
    assert_eq!(
        repo::balance(&pool, who).await.expect("잔액"),
        before - 2,
        "먼저 깎아야 한다. 끝나고 깎으면 큐에 쌓아 놓고 도망갈 수 있다"
    );
}

/* 잔액이 모자라면 큐에 안 들어간다.

넣고 나서 확인하면 워커가 집어서야 실패하고, 사용자는 몇 분 기다린 끝에
거절을 본다. */
#[sqlx::test]
async fn a_short_wallet_never_reaches_the_queue(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    // 잔액 0 인 계정. 고품질은 8 크레딧이라 못 넣는다.

    let err = repo::enqueue(&pool, who, &req("고딕 석상", "high"))
        .await
        .expect_err("잔액 부족");
    assert!(
        matches!(err, RepoError::Gen(GenError::NotEnoughCredits { .. })),
        "{err:?}"
    );

    let queued: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM gen_jobs")
        .fetch_one(&pool)
        .await
        .expect("개수");
    assert_eq!(queued, 0, "거절된 요청이 큐에 남으면 안 된다");
    assert_eq!(repo::balance(&pool, who).await.expect("잔액"), 0);
}

/* 워커 둘이 같은 작업을 안 집는다.

이 테스트가 이 파일의 존재 이유다. SKIP LOCKED 가 빠지면 여기서 잡힌다. */
#[sqlx::test]
async fn two_workers_never_claim_the_same_job(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    give(&pool, who, 1000).await;

    // 작업 다섯 개를 넣는다.
    for i in 0..5 {
        repo::enqueue(&pool, who, &req(&format!("석상 {i}"), "draft"))
            .await
            .expect("등록");
    }

    // 워커 넷이 동시에 집는다. 다섯 개짜리 큐에서 넷이 달려든다.
    let workers = ["w1", "w2", "w3", "w4"];
    // 순차로 집어도 같은 작업이 두 번 나오면 안 된다. 진짜 동시성은
    // 아래 concurrent_claims_do_not_overlap 이 본다.
    let mut claimed = Vec::new();
    for w in workers {
        if let Some(job) = repo::claim(&pool, w).await.expect("집기") {
            claimed.push(job.id);
        }
    }

    assert_eq!(claimed.len(), 4, "넷 다 하나씩 집어야 한다");
    let unique: std::collections::HashSet<_> = claimed.iter().collect();
    assert_eq!(
        unique.len(),
        claimed.len(),
        "같은 작업을 두 번 집었다 — 제공자에 두 번 보내고 요금이 두 배로 나간다: {claimed:?}"
    );

    // 하나 남았다.
    assert!(repo::claim(&pool, "w5").await.expect("집기").is_some());
    assert!(
        repo::claim(&pool, "w6").await.expect("집기").is_none(),
        "빈 큐에서는 아무것도 안 나와야 한다"
    );
}

/// 진짜 동시에 달려들어도 같은 결과여야 한다.
#[sqlx::test]
async fn concurrent_claims_do_not_overlap(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    give(&pool, who, 1000).await;
    for i in 0..8 {
        repo::enqueue(&pool, who, &req(&format!("석상 {i}"), "draft"))
            .await
            .expect("등록");
    }

    // 여덟 워커가 한꺼번에 집는다. tokio 가 이미 있어서 의존성을 더 안 넣는다.
    let mut set = tokio::task::JoinSet::new();
    for i in 0..8 {
        let pool = pool.clone();
        set.spawn(async move { repo::claim(&pool, &format!("w{i}")).await });
    }

    let mut ids = Vec::new();
    while let Some(joined) = set.join_next().await {
        if let Some(job) = joined.expect("태스크").expect("집기") {
            ids.push(job.id);
        }
    }

    assert_eq!(ids.len(), 8, "여덟 개를 여덟이 나눠 가져야 한다");
    let unique: std::collections::HashSet<_> = ids.iter().collect();
    assert_eq!(unique.len(), 8, "겹쳤다: {ids:?}");
}

/* 실패하면 재시도하고, 다 쓰면 크레딧을 돌려준다. */
#[sqlx::test]
async fn a_failed_job_retries_then_refunds(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    give(&pool, who, 100).await;
    let before = repo::balance(&pool, who).await.expect("잔액");

    let job = repo::enqueue(&pool, who, &req("고딕 석상", "standard"))
        .await
        .expect("등록");
    assert_eq!(repo::balance(&pool, who).await.expect("잔액"), before - 2);

    // 재시도가 남아 있는 동안은 큐로 돌아간다.
    let mut requeued = 0;
    loop {
        // 집어야 attempts 가 오른다.
        sqlx::query("UPDATE gen_jobs SET run_after = now() WHERE id = $1")
            .bind(job.id)
            .execute(&pool)
            .await
            .expect("대기 해제");
        let claimed = repo::claim(&pool, "w1").await.expect("집기");
        if claimed.is_none() {
            break;
        }
        if repo::fail(&pool, job.id, "provider timed out")
            .await
            .expect("실패 처리")
        {
            requeued += 1;
        } else {
            break;
        }
        assert!(requeued < 10, "무한 재시도");
    }

    assert!(requeued >= 1, "적어도 한 번은 재시도해야 한다");

    let status: String = sqlx::query_scalar("SELECT status FROM gen_jobs WHERE id = $1")
        .bind(job.id)
        .fetch_one(&pool)
        .await
        .expect("상태");
    assert_eq!(status, "failed");
    assert_eq!(
        repo::balance(&pool, who).await.expect("잔액"),
        before,
        "실패했으면 돌려줘야 한다. 우리 잘못을 사용자가 물면 안 된다"
    );
}

/// 환불은 한 번만. 콜백은 여러 번 온다.
#[sqlx::test]
async fn a_refund_happens_only_once(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    give(&pool, who, 100).await;
    let before = repo::balance(&pool, who).await.expect("잔액");
    let job = repo::enqueue(&pool, who, &req("고딕 석상", "standard"))
        .await
        .expect("등록");

    // 재시도를 다 쓰게 만든다.
    sqlx::query("UPDATE gen_jobs SET attempts = 99 WHERE id = $1")
        .bind(job.id)
        .execute(&pool)
        .await
        .expect("시도 소진");

    for _ in 0..3 {
        repo::fail(&pool, job.id, "boom").await.expect("실패 처리");
    }

    assert_eq!(
        repo::balance(&pool, who).await.expect("잔액"),
        before,
        "세 번 불러도 환불은 한 번이어야 한다"
    );
}

/* 죽은 워커의 작업을 회수한다.

우아한 종료를 붙여도 프로세스가 강제로 죽는 경우는 있다. 회수가 없으면
그 작업은 running 에 영원히 남는다. */
#[sqlx::test]
async fn a_stalled_job_goes_back_to_the_queue(pool: PgPool) {
    let who = an_account(&pool, "sh@op.gg").await;
    give(&pool, who, 100).await;
    repo::enqueue(&pool, who, &req("고딕 석상", "draft"))
        .await
        .expect("등록");

    let job = repo::claim(&pool, "doomed")
        .await
        .expect("집기")
        .expect("작업");
    // 워커가 죽었다. 시작 시각을 과거로 민다.
    sqlx::query("UPDATE gen_jobs SET started_at = now() - interval '1 hour' WHERE id = $1")
        .bind(job.id)
        .execute(&pool)
        .await
        .expect("시간 조작");

    assert_eq!(
        repo::queued_count(&pool).await.expect("대기 수"),
        0,
        "아직 running 이다"
    );

    let reaped = repo::reap_stalled(&pool, 600).await.expect("회수");
    assert_eq!(reaped, 1);
    assert_eq!(repo::queued_count(&pool).await.expect("대기 수"), 1);

    // 다른 워커가 이어받는다.
    assert!(repo::claim(&pool, "w2").await.expect("집기").is_some());
}

/// 남의 작업은 못 본다.
#[sqlx::test]
async fn a_job_belongs_to_its_owner(pool: PgPool) {
    let mine = an_account(&pool, "mine@op.gg").await;
    let other = an_account(&pool, "other@op.gg").await;
    give(&pool, mine, 100).await;

    let job = repo::enqueue(&pool, mine, &req("고딕 석상", "draft"))
        .await
        .expect("등록");

    assert!(repo::get_job(&pool, mine, job.id).await.is_ok());
    let err = repo::get_job(&pool, other, job.id)
        .await
        .expect_err("남의 작업");
    assert!(
        matches!(err, RepoError::JobNotFound(_)),
        "\"권한 없음\" 으로 알려 주면 그게 곧 남의 작업 목록이다: {err:?}"
    );
}

/* 리더는 하나다.

정리 작업을 여럿이 동시에 하면 서로 밟는다. */
#[sqlx::test]
async fn only_one_leader_runs_the_cleanup(pool: PgPool) {
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    let ran = Arc::new(AtomicUsize::new(0));

    // 둘이 동시에 락을 노린다.
    let mut set = tokio::task::JoinSet::new();
    for _ in 0..2 {
        let pool = pool.clone();
        let ran = Arc::clone(&ran);
        set.spawn(async move {
            repo::with_leader_lock(&pool, |_p| {
                let ran = Arc::clone(&ran);
                async move {
                    ran.fetch_add(1, Ordering::SeqCst);
                    // 락을 잡은 채로 잠깐 머문다. 안 그러면 순차 실행이 되어
                    // 둘 다 성공하고 테스트가 의미를 잃는다.
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    Ok(())
                }
            })
            .await
        });
    }

    let mut got = Vec::new();
    while let Some(joined) = set.join_next().await {
        got.push(joined.expect("태스크").expect("락"));
    }
    assert_eq!(
        got.iter().filter(|&&g| g).count(),
        1,
        "둘 다 리더가 되면 정리 작업이 두 번 돈다: {got:?}"
    );
    assert_eq!(ran.load(Ordering::SeqCst), 1);
}
