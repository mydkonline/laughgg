//! 판매 1건의 정산.

use serde::Serialize;

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
    #[must_use]
    pub fn new(gross_usd: f64, fee_rate: f64) -> Self {
        let rate = fee_rate.clamp(0.0, 1.0);
        let fee = (gross_usd * rate * 100.0).round() / 100.0;
        Self {
            gross_usd,
            fee_usd: fee,
            creator_usd: ((gross_usd - fee) * 100.0).round() / 100.0,
            fee_rate: rate,
        }
    }
}

/// 기본 수수료율.
pub const DEFAULT_FEE_RATE: f64 = 0.08;

#[cfg(test)]
mod tests {
    use super::{DEFAULT_FEE_RATE, Settlement};

    #[test]
    fn settlement_gives_creator_92_percent() {
        let s = Settlement::new(100.0, DEFAULT_FEE_RATE);
        assert!((s.fee_usd - 8.0).abs() < f64::EPSILON);
        assert!((s.creator_usd - 92.0).abs() < f64::EPSILON);
    }

    #[test]
    fn settlement_clamps_absurd_rates() {
        let over = Settlement::new(50.0, 3.0);
        assert!((over.fee_rate - 1.0).abs() < f64::EPSILON);
        assert!((over.creator_usd - 0.0).abs() < f64::EPSILON);

        let under = Settlement::new(50.0, -1.0);
        assert!((under.fee_rate - 0.0).abs() < f64::EPSILON);
        assert!((under.creator_usd - 50.0).abs() < f64::EPSILON);
    }
}
