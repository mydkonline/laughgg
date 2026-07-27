//! `LaughGG` API.
//!
//! 계층은 셋이고 의존은 한 방향이다.
//!   [`domain`]  판정과 계산. 바깥을 모른다.
//!   [`repo`]    Postgres 질의. `domain` 만 안다.
//!   [`http`]    라우팅과 직렬화. 둘 다 안다.
//!
//! 라이브러리로도 내놓는 이유는 하나다 — 바이너리만 있으면 `tests/` 에서
//! 가져다 쓸 수가 없어서 SQL 과 라우팅에 테스트를 못 붙인다. 실제로 붙였던
//! 결함 셋(중복 행, 잘못된 경로, 전부 500)이 전부 그 두 층에 있었다.

pub mod analyzer;
pub mod domain;
pub mod http;
pub mod metrics;
pub mod provider;
pub mod repo;
pub mod worker;
