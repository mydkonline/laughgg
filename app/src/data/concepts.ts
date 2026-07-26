/* 스튜디오의 핵심 — 에셋을 게임 컨셉에 맞추는 일.
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

/* 양극 척도라 이름과 양끝을 따로 갖는다. 화살표로 잇지 않고
   슬라이더 좌우에 각각 붙여야 어느 쪽으로 미는지가 바로 보인다. */
export const KNOB_LABEL: Record<keyof Knobs, [name: string, low: string, high: string]> = {
  tone: ["분위기", "밝게", "어둡게"],
  warm: ["색온도", "차갑게", "따뜻하게"],
  gloss: ["재질", "거칠게", "광택"],
  facet: ["면 처리", "부드럽게", "각지게"],
  sat: ["채도", "빛바래게", "쨍하게"],
  line: ["외곽선", "없이", "두껍게"],
};

/** 2D 로 뽑을 때만 쓰는 설정. 3D 미리보기에는 영향이 없다. */
export type RasterSet = {
  /** 도트 한 칸 크기 */
  pixel: number;
  /** palettes.ts 의 id */
  palette: string;
  /** 순서 디더링 세기 0–100 */
  dither: number;
};

export const NEUTRAL_RASTER: RasterSet = { pixel: 1, palette: "free", dither: 0 };

export type Concept = {
  id: string;
  name: string;
  /** 어떤 게임에 쓰는 톤인지 한 줄로 */
  note: string;
  knobs: Knobs;
  raster: RasterSet;
};

/* 컨셉은 3D 노브와 2D 설정을 한 묶음으로 갖는다.
   같은 이름을 눌렀는데 형식에 따라 딴 그림이 나오면 컨셉이라고 부를 수 없다. */
export const CONCEPTS: Concept[] = [
  {
    id: "dark",
    name: "다크 판타지",
    note: "빛을 줄이고 금속만 남긴다",
    knobs: { tone: 74, warm: 30, gloss: 62, facet: 10, sat: 38, line: 12 },
    raster: { pixel: 2, palette: "moss", dither: 34 },
  },
  {
    id: "high",
    name: "하이 판타지",
    note: "따뜻한 역광, 높은 채도",
    knobs: { tone: 28, warm: 78, gloss: 52, facet: 4, sat: 76, line: 6 },
    raster: { pixel: 2, palette: "ember", dither: 28 },
  },
  {
    id: "gb",
    name: "게임보이",
    note: "초록 네 색으로만",
    knobs: { tone: 46, warm: 44, gloss: 22, facet: 88, sat: 30, line: 22 },
    raster: { pixel: 6, palette: "gb", dither: 70 },
  },
  {
    id: "pico",
    name: "PICO-8 도트",
    note: "16색 안에서 해결",
    knobs: { tone: 40, warm: 56, gloss: 24, facet: 92, sat: 88, line: 10 },
    raster: { pixel: 5, palette: "pico8", dither: 52 },
  },
  {
    id: "toon",
    name: "셀 셰이드",
    note: "외곽선을 세우고 반사를 죽인다",
    knobs: { tone: 36, warm: 62, gloss: 14, facet: 58, sat: 80, line: 76 },
    raster: { pixel: 1, palette: "free", dither: 0 },
  },
  {
    id: "neon",
    name: "네온 사이버펑크",
    note: "어두운 바탕에 형광 두 색",
    knobs: { tone: 76, warm: 34, gloss: 78, facet: 20, sat: 94, line: 30 },
    raster: { pixel: 3, palette: "neon", dither: 46 },
  },
  {
    id: "ink",
    name: "잉크 흑백",
    note: "색을 버리고 명암만",
    knobs: { tone: 52, warm: 50, gloss: 30, facet: 70, sat: 0, line: 84 },
    raster: { pixel: 2, palette: "ink", dither: 62 },
  },
  {
    id: "sepia",
    name: "빛바랜 세피아",
    note: "채도를 빼고 난색으로",
    knobs: { tone: 44, warm: 82, gloss: 26, facet: 40, sat: 24, line: 14 },
    raster: { pixel: 2, palette: "sepia", dither: 44 },
  },
  {
    id: "cga",
    name: "CGA 레트로",
    note: "옛 PC 화면 네 색",
    knobs: { tone: 42, warm: 46, gloss: 20, facet: 94, sat: 96, line: 0 },
    raster: { pixel: 7, palette: "cga", dither: 78 },
  },
  {
    id: "one",
    name: "1비트 실루엣",
    note: "두 색, 실루엣만",
    knobs: { tone: 50, warm: 50, gloss: 34, facet: 80, sat: 0, line: 90 },
    raster: { pixel: 4, palette: "one", dither: 58 },
  },
  {
    id: "real",
    name: "사실주의",
    note: "원본 PBR 그대로",
    knobs: NEUTRAL,
    raster: NEUTRAL_RASTER,
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

/* 프롬프트가 팔레트·도트 굵기까지 정한다.
   "게임보이 느낌" 이라고 썼는데 색이 안 바뀌면 읽었다고 할 수 없다. */
const RASTER_RULES: [RegExp, Partial<RasterSet>][] = [
  [/게임보이|game.?boy|gb|초록 화면/, { palette: "gb", pixel: 6, dither: 70 }],
  [/pico|픽토|16색/, { palette: "pico8", pixel: 5, dither: 52 }],
  [/cga|4색|도스|dos/, { palette: "cga", pixel: 7, dither: 78 }],
  [/1비트|흑백 두|실루엣만|1.?bit/, { palette: "one", pixel: 4, dither: 58 }],
  [/흑백|무채|잉크|펜화|느와르|noir|monochrome/, { palette: "ink", pixel: 2, dither: 62 }],
  [/세피아|빛바|낡은 사진|sepia/, { palette: "sepia", pixel: 2, dither: 44 }],
  [/네온|사이버|형광|neon|cyber/, { palette: "neon", pixel: 3, dither: 46 }],
  [/이끼|던전|습지|늪/, { palette: "moss", pixel: 2, dither: 34 }],
  [/용암|대장간|잿|불꽃|ember|lava/, { palette: "ember", pixel: 2, dither: 28 }],
  [/굵은 도트|왕도트|저해상도/, { pixel: 9, dither: 60 }],
  [/고운 도트|잔도트|세밀/, { pixel: 2, dither: 30 }],
  [/디더|디더링|dither/, { dither: 80 }],
];

/** 프롬프트에서 읽어낸 2D 설정. */
export function rasterFromPrompt(prompt: string, base: RasterSet = NEUTRAL_RASTER): RasterSet {
  const text = prompt.toLowerCase();
  const out = { ...base };
  for (const [re, patch] of RASTER_RULES) {
    if (re.test(text)) Object.assign(out, patch);
  }
  return out;
}

/** 프롬프트가 2D 설정을 건드렸는가 — 스프라이트 모드를 자동으로 켤지 판단한다. */
export function promptWantsSprite(prompt: string): boolean {
  return RASTER_RULES.some(([re]) => re.test(prompt.toLowerCase()));
}

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
