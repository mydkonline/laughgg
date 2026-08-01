# LaughGG

게임 에셋을 사고파는 커뮤니티형 마켓이다.

창작자가 만든 3D 에셋을 올리면 서버가 파일을 직접 열어 상태를 확인하고 등급을
매긴다. 점수는 올리는 사람이 정하지 않고 파일에서 나온다. 구매자는 그 등급을
보고 이 에셋이 자기 프로젝트에 들어와도 되는 물건인지 판단한다.

에셋은 브라우저에서 바로 돌려 볼 수 있고, 실제 게임 화풍의 장면 위에 얹어
어울리는지 눈으로 확인한 다음 올린다. 만들 재료가 없으면 프롬프트로 생성해
그대로 마켓에 내놓을 수도 있다.

수수료는 8% 단일이다. Epic Fab 12%, Unity Asset Store 30% 와 비교되는
자리이고, 창작자가 판매액의 92% 를 가져간다. 등급은 수수료를 바꾸지 않는다 —
노출 순위만 정한다.

결제는 Stripe 결제창에서, 파일은 스토리지로 직접 오간다. 카드 번호도 파일도
이 서버를 지나가지 않고, 서버는 승인 통보와 키·해시만 받는다.

## 구조

Rust 백엔드와 React 프런트엔드가 한 저장소에 있다. 의존은 한 방향이다.
`domain` 은 아무것도 모르고, `repo` 는 `domain` 만 알고, `http` 는 둘 다 안다.

```
crates/api/            Rust 백엔드 (axum + sqlx / Postgres)
  src/domain/          바깥을 모르는 값 객체와 순수 함수
  src/repo/            Postgres 질의. domain 만 안다
  src/http/            라우팅·직렬화·상태 코드. 둘 다 안다
  src/analyzer/        업로드된 파일을 뜯어 채점
  src/provider/        외부 3D 생성 서비스 어댑터
  src/worker/          생성 작업 큐 처리
  migrations/          스키마와 시드
  tests/               저장소·HTTP·큐 통합 테스트

frontend/              React + Tailwind + three.js
  src/pages/           마켓, 상세, 업로드, 생성, 뷰어, 결제
  src/components/      공용 UI
  src/three/           3D 미리보기
  src/lib/             API 클라이언트, 장바구니, 포맷, 테마
  src/data/            게임·번들·요금제 정적 데이터
  src/i18n/            번역

assets/                프런트와 백엔드 테스트가 공유하는 정적 에셋
docs/                  제품·기술 문서
ops/                   Prometheus·Grafana 운영 설정
```

## 라이선스

코드는 MIT ([LICENSE](LICENSE)). 포함된 게임 에셋은 전부 CC0 ([CREDITS.md](CREDITS.md)).
