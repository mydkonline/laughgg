# IndyGG

커뮤니티형 게임 에셋 중개 마켓. 창작자가 에셋을 올리면 7개 항목을 자동 채점해 등급을 매기고,
게임 스튜디오가 구독으로 카탈로그에 접근한다.

만든 것을 **어느 게임 화풍에 어울리는지 눈으로 확인하고 올릴 수 있다**는 점이 다른 마켓과 다르다.

## 왜 만드는가

게임 아트 외주 시장은 2025년 기준 약 $5.8B이고 개발사의 68%가 아트를 외주한다.
외주는 품질이 보장되지만 비싸고 느리며, 에셋 마켓은 싸고 빠르지만 사서 열어보기 전까지
쓸 만한지 알 수 없다. IndyGG는 그 사이를 채운다 — **에셋 마켓 가격에 외주급 보증**.

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

MySQL 8.0 이상이 필요하다. 로컬은 docker로 띄우면 된다.

```sh
docker compose up -d mysql     # MySQL 8.4, DB/계정 자동 생성
cargo run -p indygg-api
# http://127.0.0.1:8420
```

환경변수: `DATABASE_URL`(기본 `mysql://indygg:indygg@127.0.0.1:3306/indygg`), `PORT`(기본 `8420`).
첫 실행 시 마이그레이션이 자동 적용되고 게임 스택 25종이 시드된다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | 헬스체크 |
| `GET` | `/api/assets` | 에셋 목록. `category` `engine` `min_score` `limit` |
| `POST` | `/api/assets` | 에셋 등록 + 즉시 검수 |
| `GET` | `/api/games` | 게임 스택. `platform` |
| `GET` | `/api/metrics` | 마켓 지표 (탈락률·구독 매출·수수료 매출) |

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

```
crates/api/
  src/domain.rs      검수 채점·등급 판정·정산 (단위 테스트 12종)
  src/db.rs          MySQL 조회·쓰기 (SQLx)
  src/main.rs        axum 라우터·정적 서빙
  migrations/        MySQL 스키마 + 게임 스택 시드
web/                 정적 페이지 (마켓·커뮤니티·창작자 랜딩)
```

## 개발

```sh
cargo check --all-targets
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
cargo test
```

`unsafe_code = "forbid"`, clippy `pedantic` + `unwrap_used = "deny"`를 적용한다.
검수 채점은 부동소수 없이 정수 연산만 쓴다 — 가중치 합이 100임을 테스트로 보장한다.

## 에셋 라이선스

포함된 게임 에셋은 전부 CC0다. 출처는 [CREDITS.md](CREDITS.md) 참조.
상용 게임 스크린샷은 저작권 문제로 저장소에서 제외했다.

## 라이선스

MIT — [LICENSE](LICENSE)
