//! 생성 요청 규칙과 크레딧 계산.
//!
//! 순수 함수만 있다. 큐도 제공자도 모른다 — 요금이 걸린 계산이라
//! 바깥 없이 혼자 검증되어야 한다.

use serde::{Deserialize, Serialize};

/// 만들 것의 방향. 제공자마다 부르는 이름이 달라 우리 말로 둔다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArtStyle {
    Realistic,
    Stylized,
    Lowpoly,
    Pixel,
}

impl ArtStyle {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Realistic => "realistic",
            Self::Stylized => "stylized",
            Self::Lowpoly => "lowpoly",
            Self::Pixel => "pixel",
        }
    }

    #[must_use]
    pub fn from_label(s: &str) -> Option<Self> {
        match s {
            "realistic" => Some(Self::Realistic),
            "stylized" => Some(Self::Stylized),
            "lowpoly" => Some(Self::Lowpoly),
            "pixel" => Some(Self::Pixel),
            _ => None,
        }
    }
}

/// 텍스처 해상도. 올릴수록 오래 걸리고 크레딧이 더 든다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    /// 초안. 형태만 본다.
    Draft,
    /// 기본.
    Standard,
    /// 4K 텍스처, 고밀도.
    High,
}

impl Quality {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Standard => "standard",
            Self::High => "high",
        }
    }

    #[must_use]
    pub fn from_label(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(Self::Draft),
            "standard" => Some(Self::Standard),
            "high" => Some(Self::High),
            _ => None,
        }
    }
}

/// 생성 요청.
#[derive(Debug, Clone, Deserialize)]
pub struct GenRequest {
    pub prompt: String,
    #[serde(default = "default_style")]
    pub art_style: String,
    #[serde(default = "default_quality")]
    pub quality: String,
}

fn default_style() -> String {
    "stylized".to_owned()
}
fn default_quality() -> String {
    "standard".to_owned()
}

/// 규칙을 통과한 요청. 여기까지 온 값은 다시 검사하지 않는다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GenSpec {
    pub art_style: ArtStyle,
    pub quality: Quality,
    pub credits: i32,
}

/// 요청이 규칙을 어긴 이유.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum GenError {
    #[error("prompt must not be empty")]
    EmptyPrompt,
    #[error("prompt is too long (max {max} characters)")]
    LongPrompt { max: usize },
    #[error("unknown art style: {0:?}")]
    BadStyle(String),
    #[error("unknown quality: {0:?}")]
    BadQuality(String),
    #[error("not enough credits: need {need}, have {have}")]
    NotEnoughCredits { need: i32, have: i32 },
}

/* 프롬프트 길이.

하한은 없다. "칼" 두 글자로도 만들 수 있고, 짧다고 거절하면 사용자가
군더더기를 붙이게 된다.

상한은 제공자 한계보다 낮게 잡는다. 넘겨 보내면 제공자가 거절하는데,
그건 크레딧을 깎은 뒤라 되돌리는 일이 한 번 더 생긴다. */
const MAX_PROMPT: usize = 500;

/* 품질별 크레딧.

제공자 단가에 비례시킨다. 처음에 1/3/8 로 뒀더니 크레딧당 원가가
draft 가 제일 비싸고 high 가 제일 쌌다 — 싼 옵션을 고르는 사람일수록
우리 마진이 깎이는 구조였다. 그게 정확히 늘리고 싶은 사용 행태인데.

1/2/4 로 맞추면 크레딧당 원가가 균일해진다. 어느 품질을 골라도 마진이
같고, 사용자는 싼 걸 눌러도 미안할 이유가 없다. 계산은 docs/pricing.md. */
const fn cost(quality: Quality) -> i32 {
    match quality {
        Quality::Draft => 1,
        Quality::Standard => 2,
        Quality::High => 4,
    }
}

impl GenRequest {
    /* 요청을 검사하고 크레딧을 계산한다.

    잔액 확인까지 여기서 한다. 큐에 넣고 나서 확인하면 이미 자리를 차지한
    뒤고, 워커가 집어서야 실패한다 — 사용자는 몇 분 기다린 끝에 거절을 본다. */
    ///
    /// # Errors
    /// 프롬프트나 옵션이 규칙을 어겼거나 잔액이 모자라면 [`GenError`] 를 반환한다.
    pub fn validate(&self, balance: i32) -> Result<GenSpec, GenError> {
        let prompt = self.prompt.trim();
        if prompt.is_empty() {
            return Err(GenError::EmptyPrompt);
        }
        // 바이트가 아니라 문자로 센다. 한글 프롬프트가 세 배로 계산되면
        // 멀쩡한 요청이 거절된다.
        if prompt.chars().count() > MAX_PROMPT {
            return Err(GenError::LongPrompt { max: MAX_PROMPT });
        }

        let art_style = ArtStyle::from_label(&self.art_style)
            .ok_or_else(|| GenError::BadStyle(self.art_style.clone()))?;
        let quality = Quality::from_label(&self.quality)
            .ok_or_else(|| GenError::BadQuality(self.quality.clone()))?;

        let credits = cost(quality);
        if balance < credits {
            return Err(GenError::NotEnoughCredits {
                need: credits,
                have: balance,
            });
        }

        Ok(GenSpec {
            art_style,
            quality,
            credits,
        })
    }

    /// 앞뒤 공백을 뗀 프롬프트. 저장에는 이 값을 쓴다.
    #[must_use]
    pub fn clean_prompt(&self) -> &str {
        self.prompt.trim()
    }
}

/* 재시도 간격.

제공자가 잠깐 밀리는 것과 영영 안 되는 것을 구분할 수 없다. 지수로 늘리되
상한을 둔다 — 무한정 늘리면 몇 시간 뒤에 조용히 성공하고, 그때는 사용자가
이미 떠났다.

재시도 횟수도 상한을 둔다. 넘기면 실패로 확정하고 크레딧을 돌려준다. */
pub const MAX_ATTEMPTS: i16 = 4;

/// 다음 시도까지 몇 초 기다리나.
#[must_use]
pub const fn backoff_seconds(attempts: i16) -> i64 {
    match attempts {
        0 | 1 => 5,
        2 => 30,
        3 => 120,
        _ => 600,
    }
}

#[cfg(test)]
mod tests {
    use super::{ArtStyle, GenError, GenRequest, Quality, backoff_seconds, cost};

    fn req(prompt: &str) -> GenRequest {
        GenRequest {
            prompt: prompt.into(),
            art_style: "stylized".into(),
            quality: "standard".into(),
        }
    }

    #[test]
    fn labels_round_trip() {
        for s in [
            ArtStyle::Realistic,
            ArtStyle::Stylized,
            ArtStyle::Lowpoly,
            ArtStyle::Pixel,
        ] {
            assert_eq!(ArtStyle::from_label(s.as_str()), Some(s));
        }
        for q in [Quality::Draft, Quality::Standard, Quality::High] {
            assert_eq!(Quality::from_label(q.as_str()), Some(q));
        }
        assert_eq!(ArtStyle::from_label("anime"), None);
        assert_eq!(Quality::from_label("ultra"), None);
    }

    #[test]
    fn an_empty_prompt_is_rejected() {
        assert_eq!(req("   ").validate(100), Err(GenError::EmptyPrompt));
    }

    #[test]
    fn prompt_length_is_counted_in_characters() {
        // 한글 501자는 UTF-8 로 1503바이트다. 바이트로 세면 멀쩡한 요청이 거절된다.
        assert!(req(&"검".repeat(500)).validate(100).is_ok());
        assert_eq!(
            req(&"검".repeat(501)).validate(100),
            Err(GenError::LongPrompt { max: 500 })
        );
    }

    #[test]
    fn a_two_character_prompt_is_fine() {
        // 하한을 두면 사용자가 군더더기를 붙이게 된다.
        assert!(req("칼").validate(100).is_ok());
    }

    #[test]
    fn unknown_options_are_rejected() {
        let bad_style = GenRequest {
            art_style: "anime".into(),
            ..req("검")
        };
        assert_eq!(
            bad_style.validate(100),
            Err(GenError::BadStyle("anime".into()))
        );

        let bad_quality = GenRequest {
            quality: "ultra".into(),
            ..req("검")
        };
        assert_eq!(
            bad_quality.validate(100),
            Err(GenError::BadQuality("ultra".into()))
        );
    }

    /* 잔액 확인을 여기서 한다.

    큐에 넣고 나서 확인하면 워커가 집어서야 실패하고, 사용자는 몇 분
    기다린 끝에 거절을 본다. */
    #[test]
    fn a_short_wallet_is_refused() {
        let high = GenRequest {
            quality: "high".into(),
            ..req("검")
        };
        assert_eq!(
            high.validate(3),
            Err(GenError::NotEnoughCredits { need: 4, have: 3 })
        );
        // 딱 맞으면 통과해야 한다. 경계에서 한 칸 어긋나는 게 제일 흔하다.
        assert!(high.validate(4).is_ok());
    }

    /* 크레딧이 제공자 단가에 비례해야 한다.

    Meshy 단가가 draft $0.05 / standard $0.10 / high $0.20 이므로
    비율이 1:2:4 다. 어긋나면 어떤 품질이 다른 품질보다 남는 장사가 되고,
    사용자가 그걸 눈치채면 그쪽으로 몰린다. */
    #[test]
    fn credits_track_the_provider_price_ratio() {
        assert_eq!(cost(Quality::Standard), cost(Quality::Draft) * 2);
        assert_eq!(cost(Quality::High), cost(Quality::Draft) * 4);
    }

    #[test]
    fn quality_costs_go_up_and_never_reach_zero() {
        assert!(cost(Quality::Draft) < cost(Quality::Standard));
        assert!(cost(Quality::Standard) < cost(Quality::High));
        // 0 이면 무제한이 된다. 요금이 걸린 값이라 명시적으로 확인한다.
        for q in [Quality::Draft, Quality::Standard, Quality::High] {
            assert!(cost(q) > 0, "{q:?}");
        }
    }

    #[test]
    fn backoff_grows_and_is_capped() {
        let waits: Vec<i64> = (0..8).map(backoff_seconds).collect();
        for pair in waits.windows(2) {
            assert!(pair[1] >= pair[0], "간격이 줄면 안 된다: {waits:?}");
        }
        assert!(
            waits.iter().all(|&w| w <= 600),
            "상한이 없으면 몇 시간 뒤에 조용히 성공한다: {waits:?}"
        );
    }
}
