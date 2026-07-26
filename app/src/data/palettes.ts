/* 색 팔레트 — 2D 테마 정합성의 절반이 여기서 나온다.
   포스터화는 색 계단을 줄일 뿐이라 원본 색조가 그대로 남는다. 팔레트를 고정해야
   "이 게임의 색"이 된다. 게임보이 초록이 게임보이처럼 보이는 이유가 그거다.

   전부 공개된 팔레트다 — 하드웨어 스펙이거나 CC0 로 배포된 것들이다. */

export type Palette = {
  id: string;
  name: string;
  /** 출처. 화면에 같이 띄운다 — 남의 색을 말없이 쓰지 않는다. */
  from: string;
  /** 빈 배열이면 팔레트를 강제하지 않는다. */
  colors: string[];
};

export const PALETTES: Palette[] = [
  { id: "free", name: "자유", from: "원본 색을 그대로 둡니다", colors: [] },
  {
    id: "gb",
    name: "게임보이 4색",
    from: "Game Boy DMG 하드웨어 팔레트",
    colors: ["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"],
  },
  {
    id: "pico8",
    name: "PICO-8 16색",
    from: "PICO-8 공개 팔레트",
    colors: [
      "#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8",
      "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA",
    ],
  },
  {
    id: "cga",
    name: "CGA 4색",
    from: "IBM CGA 모드 4 팔레트 1",
    colors: ["#000000", "#55FFFF", "#FF55FF", "#FFFFFF"],
  },
  {
    id: "one",
    name: "1비트",
    from: "흑백 두 색. 실루엣만 남습니다",
    colors: ["#101014", "#EDEDF2"],
  },
  {
    id: "ink",
    name: "잉크 4단계",
    from: "펜화와 느와르용 무채색",
    colors: ["#0B0B0F", "#3A3A46", "#8A8A99", "#E8E8EF"],
  },
  {
    id: "sepia",
    name: "세피아",
    from: "빛바랜 인쇄물 톤",
    colors: ["#1B1206", "#4A3418", "#7C5B2E", "#B08B52", "#D9BC8C", "#F2E3C8"],
  },
  {
    id: "neon",
    name: "네온 8색",
    from: "사이버펑크 계열 대비 팔레트",
    colors: ["#0D0221", "#241734", "#450D59", "#7A1CAC", "#FF2079", "#00F0FF", "#F5D300", "#F7F7FF"],
  },
  {
    id: "moss",
    name: "이끼 6색",
    from: "던전과 습지 계열 저채도",
    colors: ["#12140F", "#28301E", "#43512F", "#6B7A4A", "#9BA872", "#D2D6B4"],
  },
  {
    id: "ember",
    name: "잿불 6색",
    from: "용암과 대장간 계열 난색",
    colors: ["#140A08", "#3B1A12", "#6E2C15", "#B0521B", "#E2903A", "#F7D9A0"],
  },
];

export type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgbCache = new Map<string, Rgb[]>();

/** 팔레트를 숫자로 편다. 픽셀마다 파싱할 수 없으니 한 번만 만들어 둔다. */
export function paletteRgb(id: string): Rgb[] {
  let v = rgbCache.get(id);
  if (!v) {
    v = (PALETTES.find((p) => p.id === id)?.colors ?? []).map(hexToRgb);
    rgbCache.set(id, v);
  }
  return v;
}

/**
 * 가장 가까운 팔레트 색.
 * 사람 눈이 초록에 민감하므로 채널마다 가중치를 다르게 준다 — 균등 거리로 재면
 * 파란 쪽이 과하게 당겨져 그림이 시퍼렇게 뜬다.
 */
export function nearest(pal: Rgb[], r: number, g: number, b: number): Rgb {
  let best = pal[0]!;
  let bestD = Infinity;
  for (const c of pal) {
    const dr = (r - c[0]) * 0.5;
    const dg = (g - c[1]) * 0.7;
    const db = (b - c[2]) * 0.3;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/* 베이어 4×4 — 순서 디더링. 팔레트를 좁힐수록 띠가 생기는데, 이 격자로
   흩뿌리면 없는 중간색이 있는 것처럼 보인다. 도트 그림의 오래된 수법이다. */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));
