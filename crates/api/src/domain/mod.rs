//! 도메인 — 검수 채점, 배지 판정, 정산.
//!
//! 이 모듈은 저장소도 HTTP 도 모른다. 바깥을 모르는 대신 혼자서 다 검증되며,
//! 규칙이 바뀌었는지는 여기 테스트만 보면 안다. 의존 방향은 한쪽이다 —
//! `http` 는 `repo` 와 `domain` 을 알고, `repo` 는 `domain` 만 알고,
//! `domain` 은 아무것도 모른다.

mod account;
mod analysis;
mod badge;
mod generation;
mod money;
mod settlement;

pub use account::{CredentialError, Credentials, is_email_shaped};
pub use analysis::{Analysis, Facts, Origin, score as analyze};
pub use badge::Badge;
pub use generation::{
    ArtStyle, GenError, GenRequest, GenSpec, MAX_ATTEMPTS, Quality, backoff_seconds,
};
pub use money::Money;
pub use settlement::{DEFAULT_FEE_RATE, Settlement};
