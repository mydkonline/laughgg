/* 공방의 핵심 — 에셋을 게임 컨셉에 맞추는 일.
   만드는 능력은 곧 흔해진다. 남는 건 "이 게임의 느낌으로 가져오는" 능력이다.

   노브는 전부 실제 렌더를 바꾼다. 프리셋은 그 노브들의 조합에 이름을 붙인 것뿐이고,
   프롬프트는 키워드를 노브로 옮긴다. 어떤 경로로 들어와도 결과는 같은 여섯 숫자다. */

export type Knobs = {
  /** 밝음 ↔ 어둠. 노출과 키라이트 세기 */
  tone: number;
  /** 차가움 ↔ 따뜻함. 키라이트 색온도 */
  warm: number;
  /** 거침 ↔ 광택. roughness · metalness */
  gloss: number;
  /** 부드러움 ↔ 각짐. flatShading */
  facet: number;
  /** 탈색 ↔ 쨍함. 채도 */
  sat: number;
  /** 외곽선 두께. 0 이면 없다 */
  line: number;
};

export const NEUTRAL: Knobs = { tone: 50, warm: 50, gloss: 50, facet: 0, sat: 50, line: 0 };

export const KNOB_LABEL: Record<keyof Knobs, [string, string]> = {
  tone: ["분위기", "밝게 · 어둡게"],
  warm: ["색온도", "차갑게 · 따뜻하게"],
  gloss: ["재질", "거칠게 · 광택"],
  facet: ["면 처리", "부드럽게 · 각지게"],
  sat: ["채도", "빛바래게 · 쨍하게"],
  line: ["외곽선", "없이 · 두껍게"],
};

export type Concept = {
  id: string;
  name: string;
  /** 이 컨셉을 한 줄로 — 무엇이 달라지는지만 쓴다 */
  note: string;
  knobs: Knobs;
};

export const CONCEPTS: Concept[] = [
  {
    id: "dark",
    name: "다크 판타지",
    note: "빛을 줄이고 금속만 남긴다. 그림자가 형태를 설명한다.",
    knobs: { tone: 78, warm: 28, gloss: 64, facet: 8, sat: 34, line: 10 },
  },
  {
    id: "high",
    name: "하이 판타지",
    note: "따뜻한 역광과 높은 채도. 영웅이 서 있을 자리다.",
    knobs: { tone: 28, warm: 76, gloss: 52, facet: 4, sat: 74, line: 6 },
  },
  {
    id: "pixel",
    name: "픽셀 레트로",
    note: "면을 각지게 눕히고 색을 끊는다. 도트 옆에 놔도 안 튄다.",
    knobs: { tone: 44, warm: 56, gloss: 18, facet: 96, sat: 86, line: 0 },
  },
  {
    id: "toon",
    name: "셀 셰이드",
    note: "외곽선을 세우고 반사를 죽인다. 만화 렌더 톤.",
    knobs: { tone: 38, warm: 62, gloss: 14, facet: 58, sat: 80, line: 74 },
  },
  {
    id: "real",
    name: "사실주의",
    note: "원본 PBR 그대로. 비교 기준으로 쓴다.",
    knobs: NEUTRAL,
  },
];

/* 프롬프트를 노브로 옮긴다. 데모에서는 키워드 규칙이고, 생성 엔진을 붙이면
   여기가 모델 호출로 바뀐다 — 바깥 인터페이스는 그대로 Knobs 하나다. */
const RULES: [RegExp, Partial<Knobs>][] = [
  [/어둡|음침|다크|dark|그림자|밤/, { tone: 80, sat: 36 }],
  [/밝|화사|낮|bright|햇|light/, { tone: 22, sat: 66 }],
  [/따뜻|웜|노을|황금|golden|warm/, { warm: 80 }],
  [/차갑|쿨|한기|얼음|서늘|cold|cool/, { warm: 18 }],
  [/금속|메탈|철|강철|metal|광택|반짝/, { gloss: 82 }],
  [/거칠|무광|매트|낡|녹슨|rough|matte/, { gloss: 16 }],
  [/로우폴리|저폴리|각진|low.?poly|폴리곤/, { facet: 92 }],
  [/픽셀|도트|레트로|pixel|8.?bit/, { facet: 96, sat: 88, gloss: 18 }],
  [/만화|툰|셀|카툰|toon|cel|외곽선|아웃라인/, { line: 76, gloss: 14, sat: 78 }],
  [/빛바|바랜|탈색|무채|desatur|낡은 사진/, { sat: 16 }],
  [/쨍|선명|비비드|vivid|화려/, { sat: 88 }],
];

/** 프롬프트에서 읽어낸 노브. 언급되지 않은 축은 바탕값을 그대로 둔다. */
export function knobsFromPrompt(prompt: string, base: Knobs = NEUTRAL): Knobs {
  const text = prompt.toLowerCase();
  const out = { ...base };
  for (const [re, patch] of RULES) {
    if (re.test(text)) Object.assign(out, patch);
  }
  return out;
}

/** 프롬프트가 실제로 건드린 축. 사용자에게 "무엇을 읽었는지" 보여줄 때 쓴다. */
export function matchedAxes(prompt: string): (keyof Knobs)[] {
  const text = prompt.toLowerCase();
  const hit = new Set<keyof Knobs>();
  for (const [re, patch] of RULES) {
    if (re.test(text)) for (const k of Object.keys(patch)) hit.add(k as keyof Knobs);
  }
  return [...hit];
}

/* 검수 점수는 노브에 따라 실제로 움직인다.
   광택을 올리면 셰이더가 무거워지고, 각지게 하면 면이 줄어 가벼워진다.
   외곽선은 드로우콜을 한 번 더 쓴다. 근거 없는 가산점은 주지 않는다. */
export function scoreDelta(k: Knobs): { 런타임: number; 면구성: number; 텍스처: number } {
  return {
    런타임: Math.round((50 - k.gloss) * 0.1 + (k.facet - 50) * 0.06 - (k.line / 100) * 3),
    면구성: Math.round((k.facet - 50) * 0.08),
    텍스처: Math.round((k.gloss - 50) * 0.07 - Math.abs(k.sat - 50) * 0.05),
  };
}
