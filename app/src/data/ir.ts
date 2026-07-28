/* IR 수치 — 출처가 있는 값과 우리가 세운 가정을 절대 섞지 않는다.
   섞으면 자료가 아니라 광고가 된다. 화면에서도 둘을 갈라 표시한다. */

export type Figure = {
  label: string;
  value: string;
  unit?: string;
  note: string;
  /** 출처가 있으면 인용, 없으면 우리 계산이다 */
  source?: string;
  /** 막대를 채우는 비율 0~100. 없으면 막대를 안 그린다. */
  fill?: number;
  /** 비교 눈금 위치 0~100 */
  mark?: number;
  markLabel?: string;
};

/* 시장이 실제로 얼마나 큰가. 전부 인용값이다.

   fill 과 mark 는 숫자 옆에 붙는 막대다. fill 은 전체 중 차지하는 비율이고,
   mark 는 전년 값이 어디였는지 찍는 눈금이다. 둘 다 note 에 적힌 인용값을
   그대로 옮긴 것이며, 없는 항목은 비운다 — 채우려고 지어내면 자료가 아니다. */
export const MARKET: Figure[] = [
  { label: "2025년 스팀 신작", value: "19,606", unit: "종", note: "전년 대비 +14.3%", fill: 100, mark: 87.5, markLabel: "전년" },
  { label: "Unity 생태계 개발자", value: "500", unit: "만 명", note: "엔진 점유 51%", fill: 51 },
  { label: "게임 아트 외주 시장", value: "58", unit: "억 달러", note: "개발사 68%가 외주", fill: 68 },
];

/** 출처는 카드마다 붙이면 숫자를 가린다. 섹션 아래 한 줄로 모은다. */
export const MARKET_SOURCE =
  "Video Game Insights 2026, Unity 게임 산업 리포트 2026, Dataintelo 2025";

/** 수익 모델. 고정비와 이탈률까지 적어 두지 않으면 검증할 수 없다. */
export const MODEL = {
  assumptions: [
    ["구독", 49, "월"],
    ["수수료", "8%", "단일"],
    ["고정비", 1700, "월"],
    ["순증", "4곳", "월"],
    ["이탈", "2%", "월"],
  ] as [string, string | number, string][],
  /* 곡선과 마일스톤은 구독만 반영한다. 수수료와 크레딧은 STREAMS 에서
     따로 세고, 셋을 합친 값이 STREAM_TOTAL 이다. 라벨을 안 붙이면
     같은 화면에 7.2억과 7.6억이 같이 떠서 어느 쪽이 맞는지 알 수 없다. */
  milestones: [
    ["월 흑자 전환", "7개월"],
    ["누적 손익분기", "13개월"],
    ["24개월 구독 MRR", 6027],
    ["구독 ARR", 72_000],
  ] as [string, string | number][],
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
export const FUNNEL_RESULT = { seats: 123, price: 49, mrr: 6027, arr: 72_000 };

/** 분석 7항목과 가중치. 합이 100 이어야 한다. */
export const CHECK_WEIGHTS: [string, number, string][] = [
  ["라이선스 출처", 22, "학습 소스 역추적"],
  ["런타임 비용", 18, "드로우콜과 셰이더 비용"],
  ["면 무결성", 15, "토폴로지와 UV 검사"],
  ["텍스처 품질", 13, "해상도와 압축 손실"],
  ["LOD 구성", 12, "단계별 면 수 감소율"],
  ["통합 난이도", 12, "엔진 임포트 소요"],
  ["코드 품질", 8, "셰이더와 스크립트 결합도"],
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
    body: "생성 도구로 뽑은 모델이 하루에 수백 개씩 쌓이는데 어느 게 쓸 만한지 사람이 다 못 봅니다. 올려서 분석 돌리고 점수순으로 거르는 게 지금 유일한 방법입니다.",
    used: "분석",
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
    used: "분석",
  },
];

/* AI 시대 개발자 규모. 전부 인용값이고 출처는 화면에 같이 낸다. */
export const AI_DEV: Figure[] = [
  { label: "AI 를 쓰는 게임 개발자", value: "90", unit: "%", note: "5개국 615명 조사", fill: 90 },
  { label: "AI 사용을 명시한 스팀 게임", value: "7,300", unit: "종", note: "2024년의 2배", fill: 100, mark: 50, markLabel: "전년" },
  { label: "1인 개발자 비중", value: "21", unit: "%", note: "전년 18%", fill: 21, mark: 18, markLabel: "전년" },
];

export const AI_DEV_SOURCE = "Google Cloud 게임 개발자 조사 2025, Steam AI 공시 집계 2026";


/* 수익원 셋. 성격이 달라 한 표에 못 담는다 —
   구독은 게임사에서 매달, 수수료는 거래마다, 크레딧은 쓴 만큼 받는다.

   합이 아래 MODEL.milestones 의 24개월 MRR 과 맞아야 한다. */
export type Stream = {
  no: number;
  name: string;
  who: string;
  /** 어떻게 받는가 */
  how: string;
  /** [항목, 값] */
  assume: [string, string | number][];
  /** 계산식 토큰. 돈은 숫자(만원)로 두면 화면에서 통화에 맞춰 적힌다. */
  calc: (string | number)[];
  /** 월 기여액, 만원 */
  mrr: number;
  note: string;
};

export const STREAMS: Stream[] = [
  {
    no: 1,
    name: "게임사 구독",
    who: "게임 개발사",
    how: "매달 정액",
    assume: [
      ["구독 게임사", "123곳"],
      ["월 구독료", 49],
      ["월 이탈", "2%"],
    ],
    calc: ["123곳", "×", 49],
    mrr: 6027,
    note: "주 수익원입니다. 카탈로그 접근과 분석 리포트를 엽니다.",
  },
  {
    no: 2,
    name: "거래 수수료",
    who: "창작자",
    how: "팔릴 때마다",
    assume: [
      ["게임사당 월 구매", "3건"],
      ["평균 단가", "$30"],
      ["수수료율", "8% 단일"],
    ],
    calc: ["123곳", "×", "3건", "×", "$30", "×", "8%"],
    mrr: 117,
    note: "배지에 연동하지 않습니다. 채점하는 쪽이 값도 정하면 이해가 충돌합니다.",
  },
  {
    no: 3,
    name: "AI 크레딧",
    who: "창작자와 게임사",
    how: "쓴 만큼",
    assume: [
      ["팀당 사용 인원", "2.5명"],
      ["무료 초과 비율", "30%"],
      ["초과분 월 결제", 1.9],
    ],
    calc: ["308명", "×", "30%", "×", 1.9],
    mrr: 175,
    note: "월 20회까지 무료입니다. 컨셉 프리셋과 직접 조정은 계속 무료입니다.",
  },
];

export const STREAM_TOTAL = {
  mrr: STREAMS.reduce((a, s) => a + s.mrr, 0),
  // 연 환산도 만원 단위 숫자로 둔다 — 표기는 화면에서 통화에 맞춰 만든다.
  arr: STREAMS.reduce((a, s) => a + s.mrr, 0) * 12,
};


/* 밸류에이션.

   future-value-valuation 스킬로 계산했다. sBG 잔존 모델로 코호트를 굴리고,
   할인율 30% DCF 에 몬테카를로 3,000회를 얹었다.

   투자자가 보는 건 넷이다 — 한 곳을 얼마에 데려와 얼마를 버는가(유닛),
   얼마나 남는가(잔존), 회사가 얼마인가(기업가치), 틀리면 어떻게 되는가(시나리오).
   계산 과정은 안 낸다. 결과만 낸다. */

export const UNIT: [string, string | number, string][] = [
  ["게임사당 월매출", 51.4, "구독·수수료·크레딧 합산"],
  ["월 계약마진", 31.1, "총이익률 78%"],
  ["획득 비용 회수", "3.9개월", "CAC {v}"],
  ["LTV / CAC", "5.9배", "통상 기준 3배"],
] as const;

/** sBG 잔존 곡선. 초기 이탈이 높고 뒤로 갈수록 안정된다. */
export const RETENTION: [string, number][] = [
  ["6개월", 89],
  ["12개월", 81],
  ["24개월", 70],
  ["36개월", 62],
];

/** 몬테카를로 3,000회. ARPU·총이익률·순증을 삼각분포로 흔들었다. */
export const VALUATION = {
  p10: "0.7억",
  p50: "4.5억",
  p90: "8.3억",
  lossChance: "0%",
  runs: "3,000회",
  discount: "30%",
};

export const SCENARIOS: [string, string, string][] = [
  ["비관", "-2.4억", "순증 2곳, 이익률 68%"],
  ["기준", "4.0억", "순증 4곳, 이익률 78%"],
  ["낙관", "13.5억", "순증 7곳, 이익률 85%"],
];


/* 진출 순서.

   에셋 마켓은 양면 시장이다. 창작자가 없는데 게임사를 부르면 살 게 없는
   마켓을 보여 주게 되고, 그 첫인상은 되돌리기 어렵다. 그래서 생산이 몰려
   있는 지역을 먼저 열고, 지갑이 제일 큰 지역을 마지막에 연다.

   지역 구분은 인용이다 — 게임 아트 외주 생산은 아시아태평양(베트남·필리핀·
   인도·중국)에 몰려 있고, 구매는 북미와 서유럽에 몰려 있다. 순서와 시점은
   우리 가정이다. 둘을 섞지 않는다. */

export type Rollout = {
  phase: number;
  region: string;
  /** 이 지역에서 무엇을 얻는가 */
  role: "공급" | "수요" | "본거지";
  /** 왜 이 순서인가. 한 줄. */
  why: string;
  /** 인용인가 가정인가 */
  cited: boolean;
};

export const ROLLOUT: Rollout[] = [
  { phase: 1, region: "한국", role: "본거지", why: "OP.GG 개발자 접점, 같은 시간대", cited: false },
  { phase: 2, region: "일본", role: "수요", why: "Steam 퍼블리셔 상위 3위 국가", cited: true },
  { phase: 3, region: "동남아, 인도", role: "공급", why: "게임 아트 외주 최대 생산 허브", cited: true },
  { phase: 4, region: "동유럽", role: "공급", why: "인디 개발과 아트 외주 동시 강세", cited: true },
  { phase: 5, region: "북미, 서유럽", role: "수요", why: "구매력 최대, 공급이 쌓인 뒤에", cited: true },
];

export const ROLLOUT_SOURCE =
  "게임 아트 외주 생산은 아시아태평양(베트남, 필리핀, 인도, 중국) 집중, 구매는 북미와 서유럽 집중 — Game Art Design Service Market 2025. 일본 Steam 퍼블리셔 순위 — Game Developer, Steam publishers landscape. 단계 순서와 시점은 우리 가정입니다.";


/* 기대효과.

   여기 있는 값은 밸류에이션에 안 넣었다. 계약도 합의도 아직 없는 것을 현금흐름에
   넣으면 그 순간 자료가 아니라 희망이 된다. 다만 이 넷은 성사되면 앞의 숫자들이
   통째로 올라가는 항목이라, 반영하지 않았다는 표시를 달고 따로 낸다.

   공통점은 하나다 — 넷 다 한 번 붙으면 다음 것이 싸게 붙는다. */

export type Upside = {
  no: number;
  name: string;
  /** 무엇이 열리는가 */
  opens: string;
  /** 무엇이 싸지거나 늘어나는가 */
  effect: string;
  /** 성사 시 바뀌는 지표 */
  metric: string;
  /** 지표에 든 금액(만원). 있으면 화면 통화로 적힌다. */
  won?: number;
};

export const UPSIDE: Upside[] = [
  {
    no: 1,
    name: "게임 네트워크 확장",
    opens: "게임사가 늘수록 엔진과 컨셉 데이터가 쌓인다",
    effect: "정합 정확도가 오르고 신규 게임사 획득 비용이 내려간다",
    metric: "CAC {v}",
    won: 120,
  },
  {
    no: 2,
    name: "허브 확장",
    opens: "지역 허브마다 현지 창작자 풀이 붙는다",
    effect: "공급 단가와 납기가 함께 내려간다",
    metric: "총이익률 78%",
  },
  {
    no: 3,
    name: "MOU 체결",
    opens: "엔진사와 퍼블리셔 파이프라인에 배지가 들어간다",
    effect: "유통 채널이 아니라 검증 표준이 된다",
    metric: "순증 월 4곳",
  },
  {
    no: 4,
    name: "인력 활용",
    opens: "외주 인력이 상시 창작자로 전환된다",
    effect: "일회성 외주비가 반복 판매 수익으로 바뀐다",
    metric: "게임사당 월매출 {v}",
    won: 51.4,
  },
];

export const UPSIDE_NOTE = "넷 모두 밸류에이션에 반영하지 않았습니다. 성사되면 위 지표가 함께 움직입니다.";
