# LaughGG

커뮤니티형 게임 에셋 중개 마켓. 창작자가 에셋을 올리면 7개 항목을 자동 채점해 등급을 매기고,
게임 스튜디오가 구독으로 카탈로그에 접근한다.

만든 것을 **어느 게임 화풍에 어울리는지 눈으로 확인하고 올릴 수 있다**는 점이 다른 마켓과 다르다.

## 왜 만드는가

게임 아트 외주 시장은 2025년 기준 약 $5.8B이고 개발사의 68%가 아트를 외주한다.
외주는 품질이 보장되지만 비싸고 느리며, 에셋 마켓은 싸고 빠르지만 사서 열어보기 전까지
쓸 만한지 알 수 없다. LaughGG는 그 사이를 채운다 — **에셋 마켓 가격에 외주급 보증**.

AI가 에셋 생성을 흔하게 만들수록 희소해지는 것은 만드는 능력이 아니라
"이게 실제로 쓸 만한가"를 보증하는 능력이다. 그래서 이 프로젝트는 에셋을 만들지 않고 **등급을 만든다**.

## 수익 구조

| 수익원 | 내용 |
|---|---|
| **스튜디오 구독** | 월 490,000원. 카탈로그 접근·검수 리포트·화풍 시연 도구·부품표 발급. **주 수익원** |
| 거래 수수료 | **8% 단일**. Epic Fab 12%, Unity Asset Store 30% 대비 낮다 |
| AI 개선 크레딧 | 무료 횟수 초과분 과금 |

수수료를 등급에 연동하지 않는다. 등급은 대신 **노출 순위**를 정한다
([`Grade::exposure_weight`](crates/api/src/domain.rs)).

창작자는 판매액의 **92%**를 가져간다. 창작자는 공급이지 수익원이 아니라고 본다.

## 검수 — 7개 항목

| 항목 | 가중치 | 무엇을 보는가 |
|---|---|---|
| 라이선스 출처 | 22% | 남의 재료가 섞이지 않았는지 |
| 런타임 비용 | 18% | 게임이 느려지지 않는지 |
| 면 무결성 | 15% | 면이 깔끔하게 짜였는지 |
| 텍스처 품질 | 13% | 텍스처가 제대로 입혀지는지 |
| LOD 구성 | 12% | 멀리 있을 때 가볍게 바뀌는지 |
| 통합 난이도 | 12% | 붙이는 데 걸리는 시간 |
| 코드 품질 | 8% | 결합도·테스트 |

라이선스 출처 점수가 60 미만이면 **다른 점수와 무관하게 탈락**한다.
출처가 불분명한 재료가 섞이면 구매자의 프로젝트 전체가 문제가 되기 때문이다.

등급은 챌린저(90+) / 다이아(80+) / 플래티넘(70+) / 실버(70 미만).

## 실행

PostgreSQL 16 이상이 필요하다. 로컬은 docker로 띄우면 된다.

```sh
docker compose up -d postgres   # PostgreSQL 16, DB/계정 자동 생성
cargo run -p laughgg-api
# http://127.0.0.1:8420
```

환경변수:

| 이름 | 기본값 | 없으면 |
|---|---|---|
| `DATABASE_URL` | `postgres://laughgg:laughgg@127.0.0.1:5432/laughgg` | 기본값으로 붙는다 |
| `PORT` | `8420` | 기본값 |
| `INSECURE_COOKIES` | (없음) | 쿠키에 `Secure`가 붙는다. 로컬 http 개발에서만 켠다 |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `GOOGLE_REDIRECT_URI` | — | 구글 로그인이 꺼지고 해당 경로가 `503` |
| `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` | — | 결제가 꺼지고 해당 경로가 `503` |

자격증명이 없어도 서버는 뜬다. DB만 있으면 되는 로컬 개발이 남의 키를 요구하기
시작하면 아무도 안 돌린다. 대신 무엇이 꺼졌는지 부팅 로그에 남는다.
첫 실행 시 마이그레이션이 자동 적용되고 게임 212종과 구독 스튜디오 4곳이 시드된다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | 헬스체크. DB에 실제로 질의하고 무엇이 켜졌는지 알려준다 |
| `GET` | `/api/assets` | 에셋 목록. `q` `category` `engine` `art_style` `badge` `min_score` `limit` `offset` |
| `GET` | `/api/assets/facets` | 축별 선택지와 개수. 목록과 같은 조건 |
| `GET` | `/api/assets/{id}` | 에셋 상세. 항목별 점수와 판매 수 |
| `POST` | `/api/assets` | 에셋 등록 + 즉시 검수. **로그인 필요**, 올린 사람이 창작자다 |
| `POST` | `/api/assets/{id}/download` | 다운로드 허가 발급. 가진 사람만 |
| `GET` | `/api/downloads/{token}` | 허가를 써서 파일 정보를 받는다 |
| `POST` | `/api/assets/{id}/review` | 등록된 에셋 재검수. 에셋을 새로 만들지 않는다 |
| `GET` | `/api/games` | 게임 목록. `q` `engine` `category` `scale` `year_from` `year_to` `uses` `limit` `offset` |
| `GET` | `/api/games/facets` | 축별 선택지와 개수. 목록과 같은 조건을 받는다 |
| `POST` | `/api/assets/{id}/sales` | 판매 기록. 가격은 에셋에서 읽는다 |
| `GET` | `/api/metrics` | 마켓 지표 (탈락률·구독 매출·수수료 매출) |

### 계정

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/auth/signup` | 가입. 세션 쿠키를 심는다 |
| `POST` | `/api/auth/login` | 로그인 |
| `POST` | `/api/auth/logout` | 로그아웃. 세션 행을 지운다 |
| `GET` | `/api/auth/me` | 내 정보 |
| `GET` | `/api/auth/google` | 구글 로그인 시작 |
| `GET` | `/api/auth/google/callback` | 구글 콜백 |

세션은 서버가 들고 있다. 쿠키에는 32바이트 난수만 들어가고 DB에는 그 SHA-256만
저장한다 — DB가 새도 그것만으로 로그인이 되면 안 되기 때문이다.
비밀번호는 Argon2id로 만든다.

### 결제

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/assets/{id}/checkout` | 주문 생성 + Stripe 결제창 주소 반환 |
| `GET` | `/api/orders` | 내 주문 목록 (결제 내역) |
| `GET` | `/api/me/library` | 내 라이브러리 (소유 목록). 같은 걸 두 번 사도 한 줄 |
| `POST` | `/api/payments/webhook` | Stripe 승인 통보. 서명을 검증한다 |

**파일도 이 서버를 지나가지 않는다.** 3D 모델은 수백 메가가 예사인데 그게 API를
통과하면 요청 하나가 워커를 오래 잡고, 재시도하면 처음부터 다시 올라간다.
파일은 스토리지로 직접 올리고 서버에는 키·크기·SHA-256만 붙인다. 키는 그대로
믿지 않는다 — `uploads/` 밖이거나 상위 경로가 섞이면 거절한다.

다운로드는 허가제다. 에셋 id를 그대로 받는 주소를 열면 산 사람이 링크를
넘기는 순간 아무나 받는다. 15분짜리 토큰을 내고 그걸로만 받게 하며,
쓸 때 소유를 한 번 더 확인한다 — 환불로 소유가 사라졌는데 허가가 남아 있을
수 있다.

**카드 번호는 이 서버를 지나가지 않는다.** 결제창은 Stripe가 자기 도메인에서
띄우고 우리는 승인 통보만 받는다. 그래서 코드 어디에도 카드 필드가 없고,
앞으로도 있으면 안 된다.

webhook은 로그인 없이 열려 있다. 서명 검증이 유일한 방어라, 검증을 지우면
누구나 결제 완료를 보내 에셋을 공짜로 가져간다 — 테스트가 그걸 잡는다.

오류는 종류대로 갈린다 — 없는 자원은 `404`, 규칙을 어긴 입력은 `400`, 나머지가 `500`이다.

에셋 등록 예시:

```sh
curl -X POST localhost:8420/api/assets -H 'content-type: application/json' -d '{
  "creator_handle":"frostforge","title":"Frostbrand Greatsword",
  "category":"weapon","engine":"unity","art_style":"stylized","price_usd":48,
  "scores":{"mesh_integrity":92,"texture_quality":88,"lod_setup":85,
            "runtime_cost":90,"license_clean":98,"code_quality":80,"integration":86}
}'
```

```json
{
  "asset_id": 1, "total": 90, "grade": "challenger",
  "production_ready": true, "license_blocked": false,
  "settlement_preview": { "gross_usd": 48.0, "fee_usd": 3.84, "creator_usd": 44.16, "fee_rate": 0.08 }
}
```

## 구조

의존은 한 방향이다. `domain`은 아무것도 모르고, `repo`는 `domain`만 알고,
`http`는 둘 다 안다. 핸들러가 SQL을 직접 쓰기 시작하면 세 층이 하나로 붙는다.

```
crates/api/
  src/domain/        검수 채점·배지 판정·정산·계정 규칙. 바깥을 모른다
  src/repo/          Postgres 질의. domain만 안다
  src/http/          라우팅·직렬화·상태 코드. 둘 다 안다
  src/lib.rs         위 셋을 내놓는다 (tests/에서 쓰려면 필요하다)
  src/main.rs        부팅만 한다
  migrations/        스키마 + 게임 212종·스튜디오 4곳 시드
  tests/             저장소·HTTP 통합 테스트
app/                 React + Tailwind 프런트 (GitHub Pages 배포)
web/                 옛 정적 페이지
```

## 개발

```sh
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
cargo test
```

테스트는 도메인 25개(순수 함수)와 통합 60개(저장소·HTTP·인증·결제·다운로드)로 나뉜다.
통합 테스트는 `#[sqlx::test]`가 테스트마다 빈 DB를 만들어 쓰므로 **Postgres가 떠 있어야 하고
`DATABASE_URL`이 필요하다.** 없으면 건너뛰지 않고 실패한다 — 조용히 넘어가면
CI는 통과하는데 아무것도 검증되지 않은 상태가 된다.

```sh
docker compose up -d postgres
DATABASE_URL=postgres://laughgg:laughgg@127.0.0.1:5432/laughgg cargo test
```

`unsafe_code = "forbid"`, clippy `pedantic` + `unwrap_used = "deny"`를 적용한다.
검수 채점은 부동소수 없이 정수 연산만 쓴다 — 가중치 합이 100임을 테스트로 보장한다.

## 에셋 라이선스

포함된 게임 에셋은 전부 CC0다. 출처는 [CREDITS.md](CREDITS.md) 참조.
상용 게임 스크린샷은 저작권 문제로 저장소에서 제외했다.

## 라이선스

MIT — [LICENSE](LICENSE)
