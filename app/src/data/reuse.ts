/* 장롱 방지 — 유형별 재사용 판정 축.

   이 마켓의 기준은 "그래픽이 좋냐"가 아니라 "산 에셋이 장롱이 되느냐, 계속
   쓰이느냐"다. 사느냐 마느냐를 가르는 축은 유형마다 다르다 — 캐릭터는 그림보다
   애니메이션이 먼저고, 배경·소품은 아트 결만 맞으면 어디에나 재사용된다.

   에셋을 심판하지 않는다. "이 유형에서 뭘 봐야 하는지"만 짧게 알려 준다.
   문구는 산문이 아니라 키워드형이다 — 한눈에 읽혀야 뜻이 있다. */

export type Risk = "낮음" | "보통" | "높음";

export type ReuseAxis = {
  /** 핵심 체크 포인트 (짧은 라벨) */
  axis: string;
  /** 한 줄 요약 (키워드형, 산문 아님) */
  note: string;
  /** 재사용 난도. 낮을수록 어디에나 다시 쓰기 쉽다. */
  risk: Risk;
};

/* 난도를 뜻이 바로 읽히는 말로 — "난도 낮음"보다 "재사용 쉬움"이 명확하다. */
export const REUSE_LABEL: Record<Risk, string> = {
  낮음: "재사용 쉬움",
  보통: "재사용 보통",
  높음: "재사용 어려움",
};

/* 키는 마켓 분류(CatKey)와 업로드 분류가 공유하는 문자열이다. */
export const REUSE_AXIS: Record<string, ReuseAxis> = {
  char: { axis: "애니메이션 포함 여부", note: "원하는 모션 없으면 못 씀", risk: "높음" },
  weapon: { axis: "그립/리깅 호환", note: "본 안 맞으면 장착 불가", risk: "높음" },
  tool: { axis: "제작자 지원 (튜토/문서)", note: "튜토/문서 없으면 장롱", risk: "높음" },
  env: { axis: "아트 결 (PBR/로폴/복셀)", note: "결 안 맞으면 배경만 튐", risk: "보통" },
  light: { axis: "렌더 파이프라인 (URP/HDRP)", note: "파이프라인 다르면 안 켜짐", risk: "보통" },
  furniture: { axis: "아트 결/스케일", note: "결/크기 맞으면 어디나", risk: "낮음" },
  prop: { axis: "아트 결/스케일", note: "결/크기 맞으면 어디나", risk: "낮음" },
  tex: { axis: "타일링/PBR 채널", note: "맞으면 모든 표면 재사용", risk: "낮음" },
  util: { axis: "모든 프로젝트 필수", note: "장롱 될 일 없음", risk: "낮음" },
  sfx: { axis: "돌려 쓰기 좋은가", note: "효과음은 어느 게임에나 재사용", risk: "낮음" },
  vfx: { axis: "돌려 쓰기 좋은가", note: "파티클은 플머가 만들기 어렵고 어디에나 재사용", risk: "낮음" },
  music: { axis: "돌려 쓰기 좋은가", note: "음악은 그냥 사서 어디에나 돌려 씀", risk: "낮음" },
};
