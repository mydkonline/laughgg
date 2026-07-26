/* IR 수치 — 출처가 있는 값과 우리가 세운 가정을 절대 섞지 않는다.
   섞으면 자료가 아니라 광고가 된다. 화면에서도 둘을 갈라 표시한다. */

export type Figure = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  /** 출처가 있으면 인용, 없으면 우리 계산이다 */
  source?: string;
};

/** 시장이 실제로 얼마나 큰가. 전부 인용값이다. */
export const MARKET: Figure[] = [
  { label: "2025년 스팀 신작", value: "19,606", unit: "종", note: "전년 대비 +14.3%" },
  { label: "Unity 생태계 개발자", value: "500", unit: "만 명", note: "엔진 점유 51%" },
  { label: "게임 아트 외주 시장", value: "58", unit: "억 달러", note: "개발사 68%가 외주" },
];

/** 출처는 카드마다 붙이면 숫자를 가린다. 섹션 아래 한 줄로 모은다. */
export const MARKET_SOURCE =
  "Video Game Insights 2026, Unity 게임 산업 리포트 2026, Dataintelo 2025";

/** 수익 모델. 고정비와 이탈률까지 적어 두지 않으면 검증할 수 없다. */
export const MODEL = {
  assumptions: [
    ["구독", "49만원", "월"],
    ["수수료", "8%", "단일"],
    ["고정비", "1,700만원", "월"],
    ["순증", "4곳", "월"],
    ["이탈", "2%", "월"],
  ],
  milestones: [
    ["월 흑자 전환", "7개월"],
    ["누적 손익분기", "13개월"],
    ["24개월 MRR", "6,027만원"],
    ["24개월 ARR", "7.2억원"],
  ],
  /** 24개월 MRR 곡선. 순증에서 이탈을 뺀 값을 누적한 모양이고,
      24개월 값이 아래 마일스톤과 같아야 해서 거기 맞춰 눕혔다. */
  curve: [0, 314, 621, 922, 1218, 1507, 1791, 2069, 2341, 2608, 2869, 3126, 3377, 3623, 3864, 4101, 4333, 4560, 4782, 5000, 5214, 5423, 5629, 5830, 6027],
};

/* 모수에서 MRR 까지 어떻게 도달하는가.
   인용값과 가정을 단계마다 표시한다 — 섞으면 계산이 아니라 주장이 된다.
   마지막 줄이 위 MODEL.milestones 의 24개월 MRR 과 맞아야 한다. */
export type FunnelStep = {
  label: string;
  value: number;
  show: string;
  /** 앞 단계에서 이만큼 남는다 */
  rate?: string;
  /** 인용값인지 우리 가정인지 */
  kind: "인용" | "가정";
  note: string;
};

export const REVENUE_FUNNEL: FunnelStep[] = [
  { label: "2025년 스팀 신작", value: 19606, show: "19,606종", kind: "인용", note: "Video Game Insights 2026" },
  { label: "AI 사용 명시", value: 7300, show: "7,300종", rate: "37%", kind: "인용", note: "Steam AI 공시 집계 2026" },
  { label: "아트를 외부 조달", value: 4964, show: "4,964종", rate: "68%", kind: "인용", note: "Dataintelo 2025" },
  { label: "유료 도구 지출", value: 596, show: "596곳", rate: "12%", kind: "가정", note: "월 49만원 지출 여력" },
  { label: "24개월 내 확보", value: 123, show: "123곳", rate: "21%", kind: "가정", note: "영업 없이 유입 기준" },
];

/** 마지막 단계에 구독료를 곱한 값. 위 퍼널과 아래 마일스톤을 잇는다. */
export const FUNNEL_RESULT = { seats: 123, price: 49, mrr: "6,027만원", arr: "7.2억원" };

/** 정적 분석 7항목과 가중치. 합이 100 이어야 한다. */
export const CHECK_WEIGHTS: [string, number, string][] = [
  ["라이선스 출처", 22, "남의 재료가 섞이지 않았는지"],
  ["런타임 비용", 18, "게임이 느려지지 않는지"],
  ["면 무결성", 15, "면이 깔끔하게 짜였는지"],
  ["텍스처 품질", 13, "텍스처가 제대로 입혀지는지"],
  ["LOD 구성", 12, "멀리 있을 때 가볍게 바뀌는지"],
  ["통합 난이도", 12, "붙이는 데 걸리는 시간"],
  ["코드 품질", 8, "결합도와 테스트"],
];


/* 사용자 리뷰.
   실명과 얼굴은 넣지 않는다. 본인 동의 없이 만든 인용은 자료가 아니라 위조다.
   소속만 인증하고 신원은 가리는 방식은 피드와 같다 — 실명으로는 프로덕션에서
   터진 얘기가 안 나온다.

   전부 시연용으로 지어낸 문장이며, 실제 인용을 받으면 이 배열을 갈아 끼운다. */
export type Review = {
  /** 이니셜 두 글자. 사진 대신 쓴다. */
  initials: string;
  role: string;
  /** 인증된 소속 유형. 회사명은 안 쓴다. */
  org: string;
  size: string;
  body: string;
  /** 이 사람이 실제로 쓴 기능 */
  used: string;
};

export const REVIEWS: Review[] = [
  {
    initials: "KM",
    role: "AI 파이프라인 TA",
    org: "국내 모바일 게임사",
    size: "40인",
    body: "생성 도구로 뽑은 모델이 하루에 수백 개씩 쌓이는데 어느 게 쓸 만한지 사람이 다 못 봅니다. 올려서 정적 분석 돌리고 점수순으로 거르는 게 지금 유일한 방법입니다.",
    used: "AI 정적 분석",
  },
  {
    initials: "JH",
    role: "1인 개발자",
    org: "PC 인디",
    size: "1인",
    body: "코드는 AI 로 짜는데 아트가 늘 병목이었습니다. 도트 게임이라 3D 를 못 썼는데 에디터에서 게임보이 팔레트로 뽑으니 기존 스프라이트 옆에 놔도 안 튀더군요.",
    used: "AI 에디터, 2D 스프라이트",
  },
  {
    initials: "SY",
    role: "아트 디렉터",
    org: "콘솔 프로젝트",
    size: "120인",
    body: "AI 로 만든 에셋은 개별 품질보다 톤 일관성이 문제입니다. 열 개를 뽑으면 열 개가 다 다른 세계관입니다. 컨셉을 고정해서 통과시키는 단계가 파이프라인에 필요했습니다.",
    used: "AI 에디터",
  },
  {
    initials: "DW",
    role: "클라이언트 프로그래머",
    org: "국내 모바일 게임사",
    size: "12인",
    body: "생성 에셋은 폴리곤과 텍스처가 제멋대로라 용량 예산을 못 잡습니다. 패키지 콘텐츠에서 LOD 단계와 텍스처 장수를 사기 전에 보는 게 큽니다.",
    used: "패키지 콘텐츠",
  },
  {
    initials: "MJ",
    role: "3D 모델러",
    org: "프리랜서",
    size: "1인",
    body: "생성이 흔해지면서 단가가 무너졌습니다. 대신 점수가 붙은 에셋은 값을 받습니다. 떨어진 항목에 수정 코드가 같이 나와서 배지 올리는 게 바로 매출로 옵니다.",
    used: "개선 코드",
  },
  {
    initials: "HS",
    role: "퍼블리싱 PM",
    org: "퍼블리셔",
    size: "300인",
    body: "AI 사용을 명시한 게임이 스팀에만 7천 종을 넘겼습니다. 심의할 때 학습 소스를 어디까지 봤는지가 쟁점인데, 라이선스 출처 항목을 공통 기준으로 쓰고 있습니다.",
    used: "AI 정적 분석",
  },
];

/* AI 시대 개발자 규모. 전부 인용값이고 출처는 화면에 같이 낸다. */
export const AI_DEV: Figure[] = [
  { label: "AI 를 쓰는 게임 개발자", value: "90", unit: "%", note: "5개국 615명 조사" },
  { label: "AI 사용을 명시한 스팀 게임", value: "7,300", unit: "종", note: "2024년의 2배" },
  { label: "1인 개발자 비중", value: "21", unit: "%", note: "전년 18%" },
];

export const AI_DEV_SOURCE = "Google Cloud 게임 개발자 조사 2025, Steam AI 공시 집계 2026";
