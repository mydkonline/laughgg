//! Prometheus 지표.
//!
//! 붙일 값을 셋으로 나눈다.
//!   RED   API 가 건강한가 — 요청 수, 지연, 오류율
//!   큐    생성이 밀리는가 — 대기 수, 소요, 성공/실패
//!   외부  남의 서비스가 문제인가 — 제공자별 호출 수와 지연
//!
//! 마지막이 없으면 "느리다" 는 신고가 왔을 때 우리가 느린 건지 Meshy 가
//! 느린 건지 구분이 안 된다. 그 구분이 안 되면 엉뚱한 데를 고치게 된다.
//!
//! 의존성을 안 늘린다. prometheus 크레이트를 넣으면 레지스트리와 매크로가
//! 딸려 오는데, 우리가 낼 지표는 열 개 남짓이라 직접 센다.

use std::{
    fmt::Write as _,
    sync::{
        Mutex, OnceLock,
        atomic::{AtomicI64, AtomicU64, Ordering},
    },
    time::Duration,
};

/// 히스토그램 구간(초). Prometheus 관례대로 누적 카운터로 낸다.
const BUCKETS: [f64; 8] = [0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];

#[derive(Default)]
struct Histogram {
    /// 구간별 누적. `le` 라벨로 나간다.
    counts: [u64; BUCKETS.len()],
    /// 구간을 넘은 것까지 포함한 전체.
    total: u64,
    sum: f64,
}

impl Histogram {
    fn observe(&mut self, seconds: f64) {
        for (i, edge) in BUCKETS.iter().enumerate() {
            if seconds <= *edge {
                self.counts[i] += 1;
            }
        }
        self.total += 1;
        self.sum += seconds;
    }
}

#[derive(Default)]
struct Registry {
    /// route/status 별 요청 수.
    requests: std::collections::HashMap<(String, u16), u64>,
    /// route 별 지연.
    latency: std::collections::HashMap<String, Histogram>,
    /// provider/status 별 작업 수.
    jobs: std::collections::HashMap<(String, String), u64>,
    /// provider 별 생성 소요.
    job_duration: std::collections::HashMap<String, Histogram>,
}

fn registry() -> &'static Mutex<Registry> {
    static R: OnceLock<Mutex<Registry>> = OnceLock::new();
    R.get_or_init(|| Mutex::new(Registry::default()))
}

/// 지금 대기 중인 작업 수. 게이지라 원자값 하나면 된다.
static QUEUED: AtomicI64 = AtomicI64::new(0);
/// 처리 중인 작업 수.
static RUNNING: AtomicU64 = AtomicU64::new(0);

/// HTTP 요청 하나를 기록한다.
pub fn record_request(route: &str, status: u16, took: Duration) {
    let Ok(mut r) = registry().lock() else {
        // 지표를 못 쓴다고 요청을 실패시키지 않는다.
        return;
    };
    *r.requests.entry((route.to_owned(), status)).or_default() += 1;
    r.latency
        .entry(route.to_owned())
        .or_default()
        .observe(took.as_secs_f64());
}

pub fn job_started() {
    RUNNING.fetch_add(1, Ordering::Relaxed);
}

pub fn job_finished(provider: &str, status: &str, took: Duration) {
    RUNNING.fetch_sub(1, Ordering::Relaxed);
    let Ok(mut r) = registry().lock() else { return };
    *r.jobs
        .entry((provider.to_owned(), status.to_owned()))
        .or_default() += 1;
    r.job_duration
        .entry(provider.to_owned())
        .or_default()
        .observe(took.as_secs_f64());
}

/// 대기 중인 작업 수. **이게 계속 늘면 워커를 늘려야 한다.**
pub fn set_queued(n: i64) {
    QUEUED.store(n, Ordering::Relaxed);
}

/// Prometheus 텍스트 형식으로 낸다.
#[must_use]
pub fn render() -> String {
    let mut out = String::with_capacity(2048);

    out.push_str("# HELP laughgg_queued_jobs 대기 중인 생성 작업 수\n");
    out.push_str("# TYPE laughgg_queued_jobs gauge\n");
    let _ = writeln!(
        out,
        "laughgg_queued_jobs {}",
        QUEUED.load(Ordering::Relaxed)
    );

    out.push_str("# HELP laughgg_running_jobs 처리 중인 생성 작업 수\n");
    out.push_str("# TYPE laughgg_running_jobs gauge\n");
    let _ = writeln!(
        out,
        "laughgg_running_jobs {}",
        RUNNING.load(Ordering::Relaxed)
    );

    let Ok(r) = registry().lock() else {
        return out;
    };

    out.push_str("# HELP laughgg_http_requests_total HTTP 요청 수\n");
    out.push_str("# TYPE laughgg_http_requests_total counter\n");
    for ((route, status), n) in &r.requests {
        let _ = writeln!(
            out,
            "laughgg_http_requests_total{{route=\"{route}\",status=\"{status}\"}} {n}"
        );
    }

    out.push_str("# HELP laughgg_http_duration_seconds HTTP 지연\n");
    out.push_str("# TYPE laughgg_http_duration_seconds histogram\n");
    for (route, h) in &r.latency {
        write_histogram(
            &mut out,
            "laughgg_http_duration_seconds",
            &format!("route=\"{route}\""),
            h,
        );
    }

    out.push_str("# HELP laughgg_jobs_total 끝난 생성 작업 수\n");
    out.push_str("# TYPE laughgg_jobs_total counter\n");
    for ((provider, status), n) in &r.jobs {
        let _ = writeln!(
            out,
            "laughgg_jobs_total{{provider=\"{provider}\",status=\"{status}\"}} {n}"
        );
    }

    out.push_str("# HELP laughgg_job_duration_seconds 생성 소요\n");
    out.push_str("# TYPE laughgg_job_duration_seconds histogram\n");
    for (provider, h) in &r.job_duration {
        write_histogram(
            &mut out,
            "laughgg_job_duration_seconds",
            &format!("provider=\"{provider}\""),
            h,
        );
    }

    out
}

fn write_histogram(out: &mut String, name: &str, labels: &str, h: &Histogram) {
    for (i, edge) in BUCKETS.iter().enumerate() {
        let _ = writeln!(
            out,
            "{name}_bucket{{{labels},le=\"{edge}\"}} {}",
            h.counts[i]
        );
    }
    // +Inf 는 전체 개수다. 이게 빠지면 Prometheus 가 히스토그램으로 안 읽는다.
    let _ = writeln!(out, "{name}_bucket{{{labels},le=\"+Inf\"}} {}", h.total);
    let _ = writeln!(out, "{name}_sum{{{labels}}} {}", h.sum);
    let _ = writeln!(out, "{name}_count{{{labels}}} {}", h.total);
}

#[cfg(test)]
mod tests {
    use super::{BUCKETS, Histogram, render, set_queued};

    #[test]
    fn buckets_are_sorted() {
        // 순서가 어긋나면 Prometheus 가 조용히 잘못 읽는다.
        for pair in BUCKETS.windows(2) {
            assert!(pair[0] < pair[1], "{BUCKETS:?}");
        }
    }

    #[test]
    fn a_histogram_is_cumulative() {
        let mut h = Histogram::default();
        for v in [0.01, 0.2, 0.7, 3.0, 30.0] {
            h.observe(v);
        }
        // 누적이라 뒤 구간이 앞 구간보다 작으면 안 된다.
        for pair in h.counts.windows(2) {
            assert!(pair[1] >= pair[0], "{:?}", h.counts);
        }
        assert_eq!(h.total, 5, "구간을 넘은 것도 전체에는 들어간다");
        assert!(
            h.counts[BUCKETS.len() - 1] < h.total,
            "30초는 마지막 구간도 넘는다"
        );
    }

    #[test]
    fn the_output_has_what_prometheus_needs() {
        set_queued(7);
        let out = render();
        assert!(out.contains("laughgg_queued_jobs 7"));
        // TYPE 이 없으면 Prometheus 가 타입을 추측한다.
        assert!(out.contains("# TYPE laughgg_queued_jobs gauge"));
        assert!(out.contains("# HELP"));
    }
}
