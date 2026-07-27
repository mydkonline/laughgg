/* 정적 분석 7항목.

   가중치는 서버(crates/api/src/domain/score.rs)와 같은 값이어야 한다. 갈리면
   화면에 뜬 점수와 실제로 받은 배지가 달라진다 — 올린 사람 입장에서는
   그게 제일 나쁜 종류의 버그다.

   합이 정확히 100 이다. 서버 쪽에도 그걸 확인하는 테스트가 있다. */

export type CheckKey =
  | "license_clean"
  | "runtime_cost"
  | "mesh_integrity"
  | "texture_quality"
  | "lod_setup"
  | "integration"
  | "code_quality";

export type Check = { key: CheckKey; label: string; weight: number; why: string };

export const CHECKS: Check[] = [
  { key: "license_clean", label: "라이선스 출처", weight: 22, why: "학습 소스 역추적" },
  { key: "runtime_cost", label: "런타임 비용", weight: 18, why: "드로우콜과 셰이더 비용" },
  { key: "mesh_integrity", label: "면 무결성", weight: 15, why: "토폴로지와 UV 검사" },
  { key: "texture_quality", label: "텍스처 품질", weight: 13, why: "해상도와 압축 손실" },
  { key: "lod_setup", label: "LOD 구성", weight: 12, why: "단계별 면 수 감소율" },
  { key: "integration", label: "통합 난이도", weight: 12, why: "엔진 임포트 소요" },
  { key: "code_quality", label: "코드 품질", weight: 8, why: "셰이더와 스크립트 결합도" },
];

/** 라이선스 출처가 이 값 미만이면 다른 점수와 무관하게 탈락한다. */
export const LICENSE_FLOOR = 60;
