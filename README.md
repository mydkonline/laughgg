# LaughGG

게임 에셋을 사고파는 커뮤니티형 마켓.

창작자가 3D 에셋을 올리면 서버가 파일을 열어 채점하고 등급을 매긴다. 등급은
올리는 사람이 정하지 않는다. 에셋은 브라우저에서 바로 돌려 볼 수 있고, 실제
게임 화풍의 장면 위에 얹어 확인한 뒤 올린다. 프롬프트로 생성해 그대로 내놓는
것도 된다.

수수료는 8% 단일. 창작자가 판매액의 92% 를 가져간다. 등급은 수수료가 아니라
노출 순위를 정한다.

## 구조

```
crates/api/            Rust 백엔드 (axum + sqlx / Postgres)
  src/domain/          값 객체와 순수 함수
  src/repo/            Postgres 질의
  src/http/            라우팅·직렬화
  src/analyzer/        업로드 파일 채점
  src/provider/        외부 3D 생성 서비스 연동
  src/worker/          생성 작업 큐 처리
  migrations/          스키마와 시드
  tests/               통합 테스트

frontend/              React + Tailwind + three.js
  src/pages/           마켓, 상세, 업로드, 생성, 뷰어, 결제
  src/components/      공용 UI
  src/three/           3D 미리보기
  src/lib/             API 클라이언트, 장바구니, 포맷
  src/data/            정적 데이터
  src/i18n/            번역

assets/                공유 정적 에셋
docs/                  제품·기술 문서
ops/                   Prometheus·Grafana 설정
```

## 라이선스

코드는 MIT ([LICENSE](LICENSE)). 게임 에셋은 CC0 ([CREDITS.md](CREDITS.md)).
