//! 금액 — 최소 단위(센트) 정수.

use serde::Serialize;

/// 금액. 센트(1/100 달러) 정수로 든다.
///
/// 부동소수를 안 쓰므로 여러 건을 더하고 빼도 오차가 안 쌓인다. 달러 실수
/// 와의 변환은 이 타입의 경계(`from_usd`/`as_usd`)에서 한 번씩만 하고, 그
/// 사이 계산은 전부 정수로 한다. 정산의 수수료와 창작자 몫이 센트 하나까지
/// 맞아떨어지는 건 이 때문이다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(transparent)]
pub struct Money(i64);

impl Money {
    /// 0원.
    pub const ZERO: Self = Self(0);

    /// 센트 정수로 만든다.
    #[must_use]
    pub const fn from_cents(cents: i64) -> Self {
        Self(cents)
    }

    /// 담긴 센트.
    #[must_use]
    pub const fn cents(self) -> i64 {
        self.0
    }

    /// 달러 실수를 센트로. 반올림은 이 한 곳에서만 일어난다.
    #[must_use]
    #[expect(
        clippy::cast_possible_truncation,
        reason = "가격은 NUMERIC(10,2) 라 센트로 바꿔도 i64 를 넘지 않는다"
    )]
    pub fn from_usd(usd: f64) -> Self {
        Self((usd * 100.0).round() as i64)
    }

    /// 화면·API 로 나갈 달러 값.
    #[must_use]
    #[expect(
        clippy::cast_precision_loss,
        reason = "센트는 결제 상한 안이라 f64 로 정확히 표현된다"
    )]
    pub fn as_usd(self) -> f64 {
        self.0 as f64 / 100.0
    }

    /// 비율만큼 뗀 금액. 정수 센트로 반올림하고 요율은 0..=1 로 가둔다.
    #[must_use]
    #[expect(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        reason = "센트는 결제 상한 안이고 결과도 원금 이하라 i64 를 안 넘는다"
    )]
    pub fn take_rate(self, rate: f64) -> Self {
        Self((self.0 as f64 * rate.clamp(0.0, 1.0)).round() as i64)
    }

    /// 뺀 금액. 음수로 내려가지 않는다.
    #[must_use]
    pub const fn saturating_sub(self, other: Self) -> Self {
        Self(self.0.saturating_sub(other.0))
    }
}

#[cfg(test)]
mod tests {
    use super::Money;

    #[test]
    fn usd_roundtrip_is_exact_for_two_decimals() {
        for usd in [0.0, 0.01, 0.99, 12.34, 29.99, 100.0] {
            let m = Money::from_usd(usd);
            assert!((m.as_usd() - usd).abs() < f64::EPSILON, "{usd} 왕복이 어긋난다");
        }
    }

    #[test]
    fn from_usd_rounds_to_the_nearest_cent() {
        // 부동소수로 29.99*100 은 2998.9999… 다. 반올림이 여기서 걸린다.
        assert_eq!(Money::from_usd(29.99).cents(), 2999);
        assert_eq!(Money::from_usd(0.005).cents(), 1);
        assert_eq!(Money::from_usd(0.004).cents(), 0);
    }

    #[test]
    fn rate_and_remainder_always_sum_to_the_whole() {
        // 원금 = 뗀 것 + 남은 것. 센트 하나도 안 새야 한다.
        for cents in [1, 7, 10, 99, 100, 2999, 12_345] {
            let gross = Money::from_cents(cents);
            let fee = gross.take_rate(0.08);
            let rest = gross.saturating_sub(fee);
            assert_eq!(fee.cents() + rest.cents(), cents, "{cents} 에서 합이 안 맞는다");
        }
    }

    #[test]
    fn take_rate_clamps_absurd_rates() {
        let m = Money::from_cents(5000);
        assert_eq!(m.take_rate(3.0), m, "1 을 넘는 요율은 전부");
        assert_eq!(m.take_rate(-1.0), Money::ZERO, "음수 요율은 0");
    }
}
