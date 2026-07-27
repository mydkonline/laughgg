//! 외부 생성 서비스.
//!
//! 제공자를 갈아 끼울 수 있게 trait 하나로 감싼다. 단가 때문이 아니라
//! 가용성 때문이다 — 생성 API 는 큐가 밀리면 수 분씩 걸리고, 한 곳이 죽으면
//! 우리 기능도 같이 죽는다.
//!
//! 조사 결과는 `docs/ai-generation.md` 에 있다. 요약하면 `Meshy` 가 1순위,
//! `Tripo3D` 가 폴백이다.

pub mod meshy;

use crate::domain::{ArtStyle, Quality};

/// 생성 결과. 우리가 받는 건 파일 주소다.
#[derive(Debug, Clone)]
pub struct Generated {
    /// 내려받을 수 있는 모델 주소. 제공자 CDN 이라 오래 안 산다.
    pub model_url: String,
    /// 미리보기 이미지. 없는 제공자도 있다.
    pub thumbnail_url: Option<String>,
}

/// 제공자에 물어본 작업 상태.
#[derive(Debug, Clone)]
pub enum Progress {
    /// 아직 만드는 중. 0..=100.
    Running(u8),
    Done(Generated),
    Failed(String),
}

/// 만들 것.
#[derive(Debug, Clone)]
pub struct Spec<'a> {
    pub prompt: &'a str,
    pub art_style: ArtStyle,
    pub quality: Quality,
}

/// 제공자가 낸 오류.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    /// 자격증명이 없다. 이 서버에서는 생성을 못 한다.
    #[error("{0} is not configured")]
    NotConfigured(&'static str),

    /// 제공자가 거절했다. 우리 요청이 문제다 — 재시도해도 같다.
    #[error("{provider} rejected the request: {message}")]
    Rejected {
        provider: &'static str,
        message: String,
    },

    /// 제공자가 지금 문제다. 재시도할 값이 있다.
    #[error("{provider} is unavailable: {message}")]
    Unavailable {
        provider: &'static str,
        message: String,
    },
}

impl ProviderError {
    /// 다시 시도해 볼 만한가. 우리 요청이 틀린 거면 몇 번을 보내도 같다.
    #[must_use]
    pub const fn retryable(&self) -> bool {
        matches!(self, Self::Unavailable { .. })
    }
}

/* 생성 서비스.

비동기다. 셋 다 그렇다 — 생성이 30초에서 5분 걸려서 동기 응답이 불가능하다.
시작하면 제공자 쪽 작업 id 를 주고, 그걸로 상태를 물어본다.

async fn in trait 은 1.75 부터 native 지만 dyn 호환이 아니다. 제공자를
런타임에 고르려면 dyn 이 필요해서 열거형으로 분기한다 — 제공자가 셋을
넘지 않을 것이고, 그때까지는 이게 제일 단순하다. */
pub trait Generator {
    /// 사람이 읽는 이름. 로그와 지표 라벨에 쓴다.
    fn name(&self) -> &'static str;

    /// 만들기 시작한다. 제공자 쪽 작업 id 를 돌려준다.
    fn start(&self, spec: Spec<'_>) -> impl Future<Output = Result<String, ProviderError>> + Send;

    /// 어떻게 돼 가는지 물어본다.
    fn poll(
        &self,
        provider_ref: &str,
    ) -> impl Future<Output = Result<Progress, ProviderError>> + Send;
}
