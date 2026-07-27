/* 요금.

   접근은 구독, 생성은 크레딧이다. 파는 게 두 종류라서다 — 카탈로그 접근은
   한계원가가 거의 0 이고 AI 생성은 건당 실제 요금이 나간다.

   생성을 구독에 무제한으로 넣으면 한 사람이 API 요금을 태운다. 반대로
   접근까지 크레딧으로 매기면 둘러보는 데 돈이 드는 마켓이 된다.

   가격 근거와 마진 계산은 docs/pricing.md 에 있다. 여기 숫자를 고치면
   그 문서도 같이 고쳐야 한다. */

export type Plan = {
  id: string;
  name: string;
  /** 월 요금(원). 0 이면 무료다. */
  won: number;
  /** 매달 주는 크레딧. 롤오버하지 않는다. */
  credits: number;
  /** 한 줄로 누구를 위한 것인지 */
  who: string;
  features: string[];
  /** 화면에서 가운데 세울 것 */
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "무료",
    won: 0,
    credits: 20,
    who: "둘러보고 감 잡기",
    features: ["카탈로그 전체 열람", "가입 시 20크레딧", "에디터 미리보기"],
  },
  {
    id: "creator",
    name: "크리에이터",
    won: 9900,
    credits: 40,
    who: "혼자 만드는 사람",
    features: ["에셋 등록 무제한", "분석 리포트 전체", "에디터 전체 기능", "매달 40크레딧"],
  },
  {
    id: "studio",
    name: "스튜디오",
    won: 49000,
    credits: 250,
    who: "팀으로 만드는 곳",
    featured: true,
    features: [
      "크리에이터의 모든 것",
      "구독 카탈로그 접근",
      "컨셉 정합 무제한",
      "매달 250크레딧",
      "우선 처리",
    ],
  },
  {
    id: "team",
    name: "팀",
    won: 149000,
    credits: 900,
    who: "여럿이 붙는 프로젝트",
    features: ["스튜디오의 모든 것", "좌석 10개", "전용 지원", "매달 900크레딧"],
  },
];

export type Pack = { credits: number; won: number };

/* 충전 팩.

   많이 살수록 개당이 싸진다. 대량 구매자는 어차피 단가로 비교하고,
   여기서 안 깎으면 제공자 API 를 직접 쓴다. */
export const PACKS: Pack[] = [
  { credits: 20, won: 3900 },
  { credits: 60, won: 9900 },
  { credits: 200, won: 29900 },
  { credits: 600, won: 79000 },
];

/** 품질별 크레딧. 서버(domain/generation.rs)와 같은 값이어야 한다. */
export const CREDIT_COST = [
  ["draft", "초안", 1, "형태만 본다"],
  ["standard", "기본", 2, "텍스처까지"],
  ["high", "고품질", 4, "4K 텍스처, 고밀도"],
] as const;
