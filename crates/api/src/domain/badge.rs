//! 검수 배지.

use serde::{Deserialize, Serialize};

/// 검수 배지. 수수료는 배지와 무관하게 8% 단일이며, 배지는 노출 순위를 정한다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Badge {
    Challenger,
    Diamond,
    Platinum,
    Silver,
}

impl Badge {
    /// 종합 점수로부터 배지를 판정한다.
    #[must_use]
    pub const fn from_score(total: u8) -> Self {
        match total {
            90..=100 => Self::Challenger,
            80..=89 => Self::Diamond,
            70..=79 => Self::Platinum,
            _ => Self::Silver,
        }
    }

    /// 검색 결과 노출 가중치. 높을수록 위에 노출된다.
    #[must_use]
    pub const fn exposure_weight(self) -> u8 {
        match self {
            Self::Challenger => 8,
            Self::Diamond => 4,
            Self::Platinum => 2,
            Self::Silver => 1,
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Challenger => "challenger",
            Self::Diamond => "diamond",
            Self::Platinum => "platinum",
            Self::Silver => "silver",
        }
    }

    /// DB에 저장된 문자열에서 배지를 되돌린다.
    #[must_use]
    pub fn from_label(s: &str) -> Option<Self> {
        match s {
            "challenger" => Some(Self::Challenger),
            "diamond" => Some(Self::Diamond),
            "platinum" => Some(Self::Platinum),
            "silver" => Some(Self::Silver),
            _ => None,
        }
    }

    /// 프로덕션 투입 가능 여부 — 플래티넘 이상.
    #[must_use]
    pub const fn production_ready(self) -> bool {
        matches!(self, Self::Challenger | Self::Diamond | Self::Platinum)
    }
}

#[cfg(test)]
mod tests {
    use super::Badge;

    #[test]
    fn badge_boundaries_are_inclusive() {
        assert_eq!(Badge::from_score(90), Badge::Challenger);
        assert_eq!(Badge::from_score(89), Badge::Diamond);
        assert_eq!(Badge::from_score(80), Badge::Diamond);
        assert_eq!(Badge::from_score(79), Badge::Platinum);
        assert_eq!(Badge::from_score(70), Badge::Platinum);
        assert_eq!(Badge::from_score(69), Badge::Silver);
        assert_eq!(Badge::from_score(0), Badge::Silver);
    }

    #[test]
    fn label_roundtrip() {
        for g in [
            Badge::Challenger,
            Badge::Diamond,
            Badge::Platinum,
            Badge::Silver,
        ] {
            assert_eq!(Badge::from_label(g.as_str()), Some(g));
        }
        assert_eq!(Badge::from_label("bronze"), None);
    }

    #[test]
    fn exposure_weight_orders_badges() {
        assert!(Badge::Challenger.exposure_weight() > Badge::Diamond.exposure_weight());
        assert!(Badge::Diamond.exposure_weight() > Badge::Platinum.exposure_weight());
        assert!(Badge::Platinum.exposure_weight() > Badge::Silver.exposure_weight());
    }

    #[test]
    fn production_ready_excludes_silver_only() {
        assert!(Badge::Challenger.production_ready());
        assert!(Badge::Platinum.production_ready());
        assert!(!Badge::Silver.production_ready());
    }
}
