//! 7개 자동 검사 항목의 채점.

use serde::{Deserialize, Serialize};

use super::Badge;

/// 7개 자동 검사 항목의 점수.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ReviewScores {
    /// 면이 깔끔하게 짜였는지
    pub mesh_integrity: u8,
    /// 텍스처가 제대로 입혀지는지
    pub texture_quality: u8,
    /// 멀리 있을 때 가볍게 바뀌는지
    pub lod_setup: u8,
    /// 게임이 느려지지 않는지
    pub runtime_cost: u8,
    /// 남의 재료가 섞이지 않았는지
    pub license_clean: u8,
    /// 코드 품질
    pub code_quality: u8,
    /// 붙이는 데 걸리는 시간
    pub integration: u8,
}

/// 채점 실패 사유.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ScoreError {
    #[error("score out of range: {field} = {value} (expected 0..=100)")]
    OutOfRange { field: &'static str, value: u8 },
}

impl ReviewScores {
    /// 모든 항목이 0..=100 범위인지 검증한다.
    ///
    /// # Errors
    /// 범위를 벗어난 항목이 있으면 [`ScoreError::OutOfRange`]를 반환한다.
    pub const fn validate(self) -> Result<(), ScoreError> {
        let checks = [
            ("mesh_integrity", self.mesh_integrity),
            ("texture_quality", self.texture_quality),
            ("lod_setup", self.lod_setup),
            ("runtime_cost", self.runtime_cost),
            ("license_clean", self.license_clean),
            ("code_quality", self.code_quality),
            ("integration", self.integration),
        ];
        let mut i = 0;
        while i < checks.len() {
            let (field, value) = checks[i];
            if value > 100 {
                return Err(ScoreError::OutOfRange { field, value });
            }
            i += 1;
        }
        Ok(())
    }

    /// 항목별 가중치. 합이 정확히 100이어야 한다.
    const W_MESH: u32 = 15;
    const W_TEXTURE: u32 = 13;
    const W_LOD: u32 = 12;
    const W_RUNTIME: u32 = 18;
    const W_LICENSE: u32 = 22;
    const W_CODE: u32 = 8;
    const W_INTEGRATION: u32 = 12;

    /// 가중 평균 종합 점수.
    ///
    /// 라이선스 출처는 통과/탈락을 가르는 항목이므로 가장 큰 가중치를 둔다.
    /// 그다음이 실제 게임에 넣었을 때의 부담(런타임 비용)과 붙이는 비용(통합)이다.
    ///
    /// 정수 연산만 쓴다. 각 항목이 0..=100이고 가중치 합이 100이므로
    /// 분자는 최대 10,000이며 100으로 나눈 결과는 항상 `u8` 범위 안에 있다.
    #[must_use]
    pub fn total(self) -> u8 {
        let sum = u32::from(self.mesh_integrity) * Self::W_MESH
            + u32::from(self.texture_quality) * Self::W_TEXTURE
            + u32::from(self.lod_setup) * Self::W_LOD
            + u32::from(self.runtime_cost) * Self::W_RUNTIME
            + u32::from(self.license_clean) * Self::W_LICENSE
            + u32::from(self.code_quality) * Self::W_CODE
            + u32::from(self.integration) * Self::W_INTEGRATION;
        // 반올림 후 0..=100으로 좁힌다. u8::try_from 이 실패할 수 없도록 먼저 상한을 건다.
        let rounded = (sum + 50) / 100;
        let capped = if rounded > 100 { 100 } else { rounded };
        // capped <= 100 이므로 변환은 실패하지 않는다. 실패하더라도 상한값으로 수렴한다.
        u8::try_from(capped).unwrap_or(100)
    }

    /// 라이선스 출처가 불분명하면 다른 점수와 무관하게 탈락시킨다.
    /// 구매자의 프로젝트 전체가 오염될 수 있기 때문이다.
    #[must_use]
    pub const fn license_blocked(self) -> bool {
        self.license_clean < 60
    }

    /// 종합 판정.
    #[must_use]
    pub fn badge(self) -> Badge {
        if self.license_blocked() {
            return Badge::Silver;
        }
        Badge::from_score(self.total())
    }
}

#[cfg(test)]
mod tests {
    use super::{ReviewScores, ScoreError};
    use crate::domain::Badge;

    fn scores(v: u8) -> ReviewScores {
        ReviewScores {
            mesh_integrity: v,
            texture_quality: v,
            lod_setup: v,
            runtime_cost: v,
            license_clean: v,
            code_quality: v,
            integration: v,
        }
    }

    #[test]
    fn weights_sum_to_exactly_100() {
        let sum = ReviewScores::W_MESH
            + ReviewScores::W_TEXTURE
            + ReviewScores::W_LOD
            + ReviewScores::W_RUNTIME
            + ReviewScores::W_LICENSE
            + ReviewScores::W_CODE
            + ReviewScores::W_INTEGRATION;
        assert_eq!(
            sum, 100,
            "가중치 합이 100이 아니면 총점이 0..=100을 벗어난다"
        );
    }

    #[test]
    fn total_never_exceeds_100() {
        assert_eq!(scores(100).total(), 100);
    }

    #[test]
    fn uniform_scores_average_to_themselves() {
        for v in [0_u8, 42, 75, 100] {
            assert_eq!(scores(v).total(), v, "uniform {v} should average to {v}");
        }
    }

    #[test]
    fn license_failure_forces_silver_regardless_of_other_scores() {
        let s = ReviewScores {
            license_clean: 10,
            ..scores(100)
        };
        assert!(s.license_blocked());
        assert_eq!(s.badge(), Badge::Silver, "출처 불분명은 무조건 탈락");
    }

    #[test]
    fn validate_rejects_out_of_range() {
        let bad = ReviewScores {
            runtime_cost: 200,
            ..scores(80)
        };
        assert_eq!(
            bad.validate(),
            Err(ScoreError::OutOfRange {
                field: "runtime_cost",
                value: 200
            })
        );
        assert!(scores(100).validate().is_ok());
    }

    #[test]
    fn runtime_and_license_dominate_the_weighting() {
        // 라이선스만 높은 쪽이 코드 품질만 높은 쪽보다 총점이 높아야 한다.
        let license_heavy = ReviewScores {
            license_clean: 100,
            ..scores(60)
        };
        let code_heavy = ReviewScores {
            code_quality: 100,
            ..scores(60)
        };
        assert!(license_heavy.total() > code_heavy.total());
    }
}
