# LaughGG

커뮤니티형 게임 에셋 마켓. 창작자가 에셋을 올리면 서버가 파일을 뜯어 7개
항목을 채점하고 등급을 매긴다. 만든 것을 **어느 게임 화풍에 어울리는지 눈으로
확인하고 올린다**는 점이 다른 마켓과 다르다.

- 수수료 **8% 단일** (Epic Fab 12%, Unity Asset Store 30%). 창작자가 판매액의 92%.
- 등급은 수수료가 아니라 **노출 순위**를 정한다.
- 채점은 서버가 파일에서 만든다 — 올리는 사람은 점수를 못 정한다.

## 검수 7항목

라이선스 출처 22% · 런타임 비용 18% · 면 무결성 15% · 텍스처 13% ·
LOD 12% · 통합 난이도 12% · 코드 품질 8%.

라이선스 출처가 60 미만이면 다른 점수와 무관하게 탈락한다 — 출처 불명 재료가
섞이면 구매자의 프로젝트 전체가 위험해지기 때문이다. 등급은
챌린저(90+) / 다이아(80+) / 플래티넘(70+) / 실버.

## 실행

PostgreSQL 16+ 이 필요하다.

```sh
docker compose up -d postgres        # DB·계정 자동 생성
cargo run -p laughgg-api             # http://127.0.0.1:8420
```

첫 실행에 마이그레이션이 자동 적용되고 게임·구독 스튜디오가 시드된다.
자격증명(구글·Stripe·스토리지)이 없어도 서버는 뜨고, 무엇이 꺼졌는지 부팅
로그에 남는다. 관리자 계정은 `ADMIN_EMAIL`·`ADMIN_PASSWORD` 로 정한다.

프런트엔드는 별도 터미널에서 실행한다.

```sh
cd frontend
npm install
npm run dev                          # http://127.0.0.1:5173
```

## 구조

의존은 한 방향이다. `domain` 은 아무것도 모르고, `repo` 는 `domain` 만 알고,
`http` 는 둘 다 안다. 핸들러가 SQL 을 직접 쓰기 시작하면 세 층이 하나로 붙는다.

```
crates/
  api/                 Rust 백엔드
    src/domain/        바깥을 모르는 값 객체와 순수 함수
    src/repo/          Postgres 질의. domain 만 안다
    src/http/          라우팅·직렬화·상태 코드. 둘 다 안다
    migrations/        스키마 + 게임·스튜디오 시드
    tests/             저장소·HTTP 통합 테스트
frontend/              React + Tailwind 프런트 (GitHub Pages 배포)
  src/
  public/assets -> ../../assets
assets/                프런트와 백엔드 테스트가 공유하는 정적 에셋
docs/                  제품·기술 문서
ops/                   Prometheus·Grafana 운영 설정
```

돈은 `domain::Money` 정수 센트 하나로만 다룬다 — 달러 실수는 경계에서만 오간다.
카드 번호도 파일도 이 서버를 지나가지 않는다. 결제는 Stripe 결제창, 파일은
스토리지 직접 업로드이고, 서버는 승인 통보와 키·해시만 받는다.

## 개발

```sh
docker compose up -d postgres
DATABASE_URL=postgres://laughgg:laughgg@127.0.0.1:5432/laughgg cargo test
cargo clippy --all-targets --all-features -- -D warnings
```

통합 테스트는 `#[sqlx::test]` 가 테스트마다 빈 DB 를 만들어 쓰므로 Postgres 와
`DATABASE_URL` 이 있어야 한다. `unsafe_code = "forbid"`, clippy `pedantic`,
`unwrap_used = "deny"` 를 적용한다.

## 라이선스

코드는 MIT ([LICENSE](LICENSE)). 포함된 게임 에셋은 전부 CC0 ([CREDITS.md](CREDITS.md)).
