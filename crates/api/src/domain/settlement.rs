//! 판매 1건의 정산.

use serde::Serialize;

use super::Money;

/// 판매 1건의 정산 내역. 수수료 8% 단일.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Settlement {
    pub gross_usd: f64,
    pub fee_usd: f64,
    pub creator_usd: f64,
    pub fee_rate: f64,
}

impl Settlement {
    /// 판매가와 수수료율로 정산을 계산한다.
    ///
    /// 계산은 센트 정수로 한다 — 창작자 몫이 "판매가에서 수수료를 뺀 나머지"
    /// 라, 둘을 합치면 언제나 판매가와 센트까지 맞는다. 달러 실수로 각각
    /// 반올림하던 옛 방식은 홀수 값에서 합이 1센트 어긋날 여지가 있었다.
    #[must_use]
    pub fn new(gross: Money, fee_rate: f64) -> Self {
        let rate = fee_rate.clamp(0.0, 1.0);
        let fee = gross.take_rate(rate);
        let creator = gross.saturating_sub(fee);
        Self {
            gross_usd: gross.as_usd(),
            fee_usd: fee.as_usd(),
            creator_usd: creator.as_usd(),
            fee_rate: rate,
        }
    }
}

/// 기본 수수료율.
pub const DEFAULT_FEE_RATE: f64 = 0.08;

#[cfg(test)]
mod tests {
    use super::{DEFAULT_FEE_RATE, Money, Settlement};

    #[test]
    fn settlement_gives_creator_92_percent() {
        let s = Settlement::new(Money::from_usd(100.0), DEFAULT_FEE_RATE);
        assert!((s.fee_usd - 8.0).abs() < f64::EPSILON);
        assert!((s.creator_usd - 92.0).abs() < f64::EPSILON);
    }

    #[test]
    fn settlement_clamps_absurd_rates() {
        let over = Settlement::new(Money::from_usd(50.0), 3.0);
        assert!((over.fee_rate - 1.0).abs() < f64::EPSILON);
        assert!((over.creator_usd - 0.0).abs() < f64::EPSILON);

        let under = Settlement::new(Money::from_usd(50.0), -1.0);
        assert!((under.fee_rate - 0.0).abs() < f64::EPSILON);
        assert!((under.creator_usd - 50.0).abs() < f64::EPSILON);
    }

    #[test]
    fn fee_and_creator_always_sum_to_gross() {
        // 홀수 센트에서도 합이 원금과 맞아야 한다.
        for cents in [1, 7, 99, 2999, 12_345] {
            let s = Settlement::new(Money::from_cents(cents), DEFAULT_FEE_RATE);
            let sum = Money::from_usd(s.fee_usd).cents() + Money::from_usd(s.creator_usd).cents();
            assert_eq!(sum, cents, "{cents} 에서 수수료+창작자 몫이 원금과 어긋난다");
        }
    }
}
