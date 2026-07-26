//! 대시보드 집계.

use anyhow::Context as _;
use serde::Serialize;
use sqlx::PgPool;

use super::RepoResult;

/// 마켓 지표. 수익 구조를 그대로 반영한다.
#[derive(Debug, Serialize)]
pub struct Metrics {
    pub assets: i64,
    pub creators: i64,
    pub reviewed: i64,
    pub rejected: i64,
    pub rejection_rate: f64,
    pub active_studios: i64,
    pub monthly_subscription_krw: i64,
    pub monthly_fee_usd: f64,
}

/// 마켓 지표를 집계한다.
///
/// 카운트 일곱 개를 왕복 일곱 번으로 세지 않는다. 한 문장에 스칼라 서브쿼리로
/// 모으면 라운드트립이 하나로 줄고, 모든 값이 같은 스냅숏에서 나온다 —
/// 나눠 세면 그 사이에 들어온 행 때문에 비율이 100%를 넘을 수 있다.
///
/// # Errors
/// 조회 실패 시 오류를 반환한다.
pub async fn metrics(pool: &PgPool) -> RepoResult<Metrics> {
    let (
        assets,
        creators,
        reviewed,
        rejected,
        active_studios,
        monthly_subscription_krw,
        monthly_fee_usd,
    ) = sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, f64)>(
        r"SELECT
                (SELECT COUNT(*) FROM assets),
                (SELECT COUNT(*) FROM creators),
                (SELECT COUNT(*) FROM reviews),
                (SELECT COUNT(*) FROM reviews WHERE badge = 'silver'),
                (SELECT COUNT(*) FROM studios WHERE active),
                (SELECT COALESCE(SUM(monthly_krw), 0)::bigint FROM studios WHERE active),
                (SELECT COALESCE(SUM(price_usd * fee_rate), 0)::double precision FROM sales)
            ",
    )
    .fetch_one(pool)
    .await
    .context("collecting metrics")?;

    #[expect(
        clippy::cast_precision_loss,
        reason = "카운트 규모에서 f64 정밀도 손실은 표시용으로 무의미"
    )]
    let rejection_rate = if reviewed > 0 {
        (rejected as f64 / reviewed as f64 * 1000.0).round() / 10.0
    } else {
        0.0
    };

    Ok(Metrics {
        assets,
        creators,
        reviewed,
        rejected,
        rejection_rate,
        active_studios,
        monthly_subscription_krw,
        monthly_fee_usd,
    })
}
