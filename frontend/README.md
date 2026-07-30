# LaughGG frontend

React, TypeScript, Vite, Tailwind CSS로 만든 LaughGG 웹 클라이언트다.
프로덕션 빌드는 GitHub Pages의 `/laughgg/` 경로에 배포된다.

## 실행

```sh
npm install
npm run dev
```

개발 서버는 `http://127.0.0.1:5173`에서 실행된다. `/api` 요청은 기본적으로
`http://127.0.0.1:8420`의 Rust API로 프록시한다. 다른 API를 사용하려면
`.env.local`에 `VITE_API_ORIGIN`을 지정한다.

## 검증

```sh
npm run lint
npm run build
```

## 구조

```text
src/
  components/   여러 화면에서 재사용하는 UI
  data/         정적 카탈로그와 화면 구성 데이터
  i18n/         언어별 문구
  lib/          API 클라이언트와 브라우저 유틸리티
  pages/        라우트 단위 화면
  three/        Three.js 렌더링
public/
  assets -> ../../assets
```

정적 에셋의 원본은 저장소 루트 `assets/`가 소유한다. 로컬의
`public/assets` 심링크는 Git에서 제외되며, Pages 워크플로가 빌드 전에 다시 만든다.
