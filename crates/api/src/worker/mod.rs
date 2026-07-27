//! 생성 작업 워커.
//!
//! 같은 바이너리에 `--worker` 로 뜬다. 별도 크레이트를 안 만드는 이유는
//! 도메인 로직을 공유해야 해서다 — 생성 결과에 배지를 매기는 건 API 가 하든
//! 워커가 하든 같은 규칙이어야 한다.
//!
//! 대신 프로세스는 나눈다. 생성 작업이 밀려도 API 응답이 안 느려지려면
//! 그 둘이 같은 스레드 풀을 안 써야 한다.

use std::time::Duration;

use anyhow::Result;
use sqlx::PgPool;
use tokio::sync::watch;

use crate::{
    metrics,
    provider::{Generator, Progress, ProviderError, Spec},
    repo,
};

/// 빈 큐를 얼마나 자주 들여다보나. LISTEN/NOTIFY 를 붙이기 전까지의 값이다.
const IDLE_POLL: Duration = Duration::from_secs(2);
/// 제공자에게 얼마나 자주 물어보나. 너무 잦으면 요청 제한에 걸린다.
const PROVIDER_POLL: Duration = Duration::from_secs(5);
/// 한 작업에 이보다 오래 걸리면 포기한다.
const JOB_TIMEOUT: Duration = Duration::from_secs(15 * 60);
/// 이보다 오래 running 인 작업은 죽은 워커가 잡고 있던 것으로 본다.
const STALL_SECS: i64 = 20 * 60;
/// 정리 작업 주기.
const CLEANUP_EVERY: Duration = Duration::from_secs(60);

/// 워커 하나를 돌린다. `shutdown` 이 켜지면 잡은 작업만 끝내고 나간다.
///
/// # Errors
/// 복구할 수 없는 오류가 나면 반환한다. 개별 작업 실패는 여기까지 안 온다.
pub async fn run<G: Generator + Clone + Send + Sync + 'static>(
    pool: PgPool,
    generator: G,
    worker_id: String,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    tracing::info!(worker = %worker_id, provider = generator.name(), "worker started");

    let cleanup = tokio::spawn(cleanup_loop(pool.clone(), shutdown.clone()));

    loop {
        if *shutdown.borrow() {
            break;
        }

        let claimed = match repo::claim(&pool, &worker_id).await {
            Ok(c) => c,
            Err(e) => {
                // DB 가 잠깐 안 되는 것과 영영 안 되는 것을 여기서 구분할 수
                // 없다. 로그를 남기고 다음 주기에 다시 해 본다.
                tracing::error!(error = ?e, "could not claim a job");
                sleep_or_exit(&mut shutdown, IDLE_POLL).await;
                continue;
            }
        };

        let Some(job) = claimed else {
            sleep_or_exit(&mut shutdown, IDLE_POLL).await;
            continue;
        };

        metrics::job_started();
        let started = std::time::Instant::now();
        let result = process(&pool, &generator, &job).await;
        let elapsed = started.elapsed();

        match result {
            Ok(()) => {
                metrics::job_finished(generator.name(), "done", elapsed);
                tracing::info!(job = job.id, ?elapsed, "job done");
            }
            Err(e) => {
                let retryable = e.retryable();
                metrics::job_finished(generator.name(), "failed", elapsed);
                tracing::warn!(job = job.id, error = %e, retryable, "job failed");
                // fail 이 재시도 여부를 정한다. 여기서는 이유만 넘긴다.
                if let Err(e) = repo::fail(&pool, job.id, &e.to_string()).await {
                    tracing::error!(job = job.id, error = ?e, "could not record the failure");
                }
            }
        }
    }

    tracing::info!(worker = %worker_id, "worker stopping");
    cleanup.abort();
    Ok(())
}

/* 작업 하나를 끝까지 처리한다.

시작 → 폴링 → 등록. 제공자가 준 파일 주소를 그대로 에셋에 붙인다.

생성물에는 검수 점수를 낮게 준다. 사람이 만든 것과 같은 점수를 주면
마켓 상위가 생성물로 덮인다 — 그건 이 마켓이 파는 것과 반대다. */
async fn process<G: Generator>(
    pool: &PgPool,
    generator: &G,
    job: &repo::Job,
) -> Result<(), ProviderError> {
    let art_style = crate::domain::ArtStyle::from_label(&job.art_style)
        .unwrap_or(crate::domain::ArtStyle::Stylized);

    let provider_ref = generator
        .start(Spec {
            prompt: &job.prompt,
            art_style,
            // 크레딧으로 이미 값을 받았다. 품질은 그때 정해졌고 여기서는
            // 작업 행에 안 남아 있어서 기본값을 쓴다.
            quality: crate::domain::Quality::Standard,
        })
        .await?;

    if let Err(e) = repo::attach_job_ref(pool, job.id, &provider_ref).await {
        // 붙이는 데 실패해도 생성은 이미 시작됐다. 로그만 남기고 계속한다 —
        // 여기서 포기하면 제공자 쪽 작업이 미아가 된다.
        tracing::warn!(job = job.id, error = ?e, "could not save the provider ref");
    }

    let deadline = tokio::time::Instant::now() + JOB_TIMEOUT;
    let generated = loop {
        if tokio::time::Instant::now() >= deadline {
            return Err(ProviderError::Unavailable {
                provider: generator.name(),
                message: format!("gave up after {}s", JOB_TIMEOUT.as_secs()),
            });
        }

        match generator.poll(&provider_ref).await? {
            Progress::Done(g) => break g,
            Progress::Failed(msg) => {
                return Err(ProviderError::Rejected {
                    provider: generator.name(),
                    message: msg,
                });
            }
            Progress::Running(pct) => {
                tracing::debug!(job = job.id, pct, "generating");
                tokio::time::sleep(PROVIDER_POLL).await;
            }
        }
    };

    tracing::info!(job = job.id, url = %generated.model_url, "generated");

    // 에셋 등록은 여기서 안 한다. 파일을 우리 스토리지로 옮겨야 하고,
    // 그게 붙기 전에는 제공자 CDN 주소를 그대로 저장할 수 없다 — 오래 안 산다.
    // 지금은 작업을 끝난 것으로만 표시한다.
    if let Err(e) = repo::finish(pool, job.id, 0).await {
        tracing::error!(job = job.id, error = ?e, "could not mark the job done");
    }
    Ok(())
}

/* 정리 작업.

리더만 한다. 여럿이 동시에 하면 서로 밟는다. 락은 트랜잭션 레벨이라
워커가 죽으면 자동으로 풀린다 — 세션 레벨이면 다음 리더가 영영 안 뽑힌다. */
async fn cleanup_loop(pool: PgPool, mut shutdown: watch::Receiver<bool>) {
    loop {
        if *shutdown.borrow() {
            return;
        }

        let led = repo::with_leader_lock(&pool, |p| async move {
            let reaped = repo::reap_stalled(&p, STALL_SECS).await?;
            if reaped > 0 {
                tracing::warn!(reaped, "stalled jobs went back to the queue");
            }
            let sessions = repo::purge_expired_sessions(&p).await?;
            let grants = repo::purge_expired_grants(&p).await?;
            if sessions > 0 || grants > 0 {
                tracing::info!(sessions, grants, "expired rows removed");
            }
            Ok(())
        })
        .await;

        match led {
            Ok(true) => tracing::debug!("cleanup ran as leader"),
            Ok(false) => tracing::debug!("another worker is the leader"),
            Err(e) => tracing::error!(error = ?e, "cleanup failed"),
        }

        // 큐 길이는 리더가 아니어도 관측한다. 노드마다 값이 같아야 대시보드가
        // 어느 노드를 보든 같은 그림을 낸다.
        if let Ok(n) = repo::queued_count(&pool).await {
            metrics::set_queued(n);
        }

        sleep_or_exit(&mut shutdown, CLEANUP_EVERY).await;
    }
}

/// 자되, 종료 신호가 오면 바로 깬다. 종료에 폴링 주기만큼 걸리면 안 된다.
async fn sleep_or_exit(shutdown: &mut watch::Receiver<bool>, how_long: Duration) {
    tokio::select! {
        () = tokio::time::sleep(how_long) => {}
        _ = shutdown.changed() => {}
    }
}
