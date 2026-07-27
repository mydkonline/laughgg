//! 저장소 오류.
//!
//! HTTP 계층이 오류 종류에 따라 상태 코드를 고른다. 부르는 쪽이 분기한다는 건
//! 곧 타입이 있어야 한다는 뜻이라, 여기서는 `anyhow` 를 그대로 흘리지 않는다.
//! 분기할 필요가 없는 나머지는 전부 [`RepoError::Other`] 로 삼킨다.

use crate::domain::CredentialError;

#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    /// 대상이 없다. 요청이 틀린 것이지 서버가 고장 난 게 아니다.
    #[error("asset {0} not found")]
    AssetNotFound(i64),

    /// 이름으로 찾은 스튜디오가 없다.
    #[error("studio {0:?} not found")]
    StudioNotFound(String),

    /// 아직 검수를 안 받았다. 요청 자체가 이른 것이지 틀린 게 아니다.
    #[error("asset {0} has not been reviewed yet")]
    AssetNotReviewed(i64),

    /// 검수는 받았지만 판매 가능 등급이 아니다.
    #[error("asset {asset_id} is not sellable: badge {badge}")]
    AssetNotSellable { asset_id: i64, badge: String },

    /* 이미 가진 것을 또 사려 한다.

    받는 것이 파일이라 두 번 사도 얻는 게 없다. 막지 않으면 장바구니에
    남아 있던 줄 때문에 같은 값을 두 번 내게 된다. */
    #[error("asset {0} is already in your library")]
    AlreadyOwned(i64),

    /// 빈 장바구니로 결제를 눌렀다.
    #[error("the cart is empty")]
    EmptyCart,

    /* 값이 0 이라 결제할 게 없다.

    무료 배포는 판매가 아니다. 결제창에 0원짜리 줄을 세우면 결제사가
    거절하고, 그 거절이 왜 났는지는 화면에서 알 수가 없다. */
    #[error("asset {0} is free and is not sold")]
    NotForSale(i64),

    /// 이메일이 이미 쓰이고 있다. 가입 화면에서는 알려 줘야 한다.
    #[error("email {0:?} is already registered")]
    EmailTaken(String),

    /* 이메일이 없는 것과 비밀번호가 틀린 것을 구분해서 알려 주면 그게 곧
    계정 목록이 된다. 둘 다 이 하나로 낸다. */
    #[error("email or password is incorrect")]
    BadCredentials,

    /// 로그인이 필요하다.
    #[error("authentication required")]
    Unauthenticated,

    /// 로그인은 했지만 남의 것이다.
    #[error("not allowed")]
    Forbidden,

    /// 에셋은 있는데 파일이 아직 안 올라왔다.
    #[error("asset {0} has no file yet")]
    NoFile(i64),

    /// 다운로드 허가가 없거나 만료됐다. 둘을 구분해 알려 줄 이유가 없다.
    #[error("download link is invalid or has expired")]
    GrantNotFound,

    /// 입력이 규칙을 어겼다.
    #[error(transparent)]
    Credential(#[from] CredentialError),

    /// 그런 작업이 없다. 남의 작업도 여기로 온다 — "권한 없음" 으로
    /// 알려 주면 그게 곧 남의 작업 목록이다.
    #[error("no job {0}")]
    JobNotFound(i64),

    /// 생성 요청이 규칙을 어겼거나 크레딧이 모자라다.
    #[error(transparent)]
    Gen(#[from] crate::domain::GenError),

    /// 그런 글이 없다. 남의 글을 지우려는 경우도 여기로 온다 —
    /// 있는지 없는지를 알려 주면 그게 곧 남의 글 목록이다.
    #[error("no post {0:?}")]
    PostNotFound(String),

    /// 글이 규칙을 어겼다.
    #[error(transparent)]
    Post(#[from] crate::repo::PostError),

    /// 올린 파일이 규칙을 어겼다.
    #[error(transparent)]
    File(#[from] crate::repo::FileError),

    /// 나머지 — 연결 끊김, 제약 위반, 그 밖의 사고.
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

pub type RepoResult<T> = Result<T, RepoError>;
