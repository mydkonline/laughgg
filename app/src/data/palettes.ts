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

/* 레퍼런스 이미지에서 뽑은 팔레트.

   올린 스크린샷의 색을 그대로 쓴다. 목록에 박아 둔 팔레트는 공개된 하드웨어
   스펙이라 고정이지만, 이건 사람이 방금 올린 것이라 매번 바뀐다. 그래서
   PALETTES 를 건드리지 않고 따로 둔다 — 배열에 밀어 넣으면 새로고침 전까지
   목록이 계속 길어진다. */
export const REF_ID = "ref";

let refPalette: Palette | null = null;

export function setRefPalette(colors: string[], from: string) {
  refPalette = { id: REF_ID, name: "레퍼런스 이미지", from, colors };
  rgbCache.delete(REF_ID);
}

export function clearRefPalette() {
  refPalette = null;
  rgbCache.delete(REF_ID);
}

/** 지금 고를 수 있는 팔레트. 레퍼런스가 있으면 맨 앞에 온다. */
export function palettes(): Palette[] {
  return refPalette ? [refPalette, ...PALETTES] : PALETTES;
}

/** 팔레트를 숫자로 편다. 픽셀마다 파싱할 수 없으니 한 번만 만들어 둔다. */
export function paletteRgb(id: string): Rgb[] {
  let v = rgbCache.get(id);
  if (!v) {
    const src = id === REF_ID ? refPalette : PALETTES.find((p) => p.id === id);
    v = (src?.colors ?? []).map(hexToRgb);
    rgbCache.set(id, v);
  }
  return v;
}

/* 이미지에서 색 몇 개를 뽑는다.

   k-means 를 돌리면 정확하지만 브라우저에서 큰 그림에 돌리면 눈에 띄게
   멈춘다. 대신 색 공간을 격자로 잘라 세고 많이 나온 칸의 평균색을 쓴다 —
   게임 스크린샷처럼 색이 뭉쳐 있는 그림에서는 결과가 거의 같다.

   샘플을 줄여서 본다. 1920×1080 을 전부 세면 200만 번인데, 격자로 뭉갤
   거라 열 픽셀에 하나만 봐도 순위가 안 바뀐다. */
export function extractPalette(img: HTMLImageElement, want = 6): string[] {
  const W = 160;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, W, h);
  const { data } = ctx.getImageData(0, 0, W, h);

  /* 칸마다 합과 개수를 쌓는다. 채널당 5비트(32칸)면 32768 칸인데,
     화면 하나에 실제로 쓰이는 색은 그보다 훨씬 적어서 금방 모인다. */
  const bins = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 128) continue; // 투명한 데는 색이 아니다
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cur = bins.get(key);
    if (cur) {
      cur[0] += r;
      cur[1] += g;
      cur[2] += b;
      cur[3] += 1;
    } else {
      bins.set(key, [r, g, b, 1]);
    }
  }

  const ranked = [...bins.values()].sort((x, y) => y[3] - x[3]);
  const out: Rgb[] = [];
  for (const [r, g, b, n] of ranked) {
    const avg: Rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    /* 비슷한 색이 줄줄이 뽑히면 팔레트가 한 덩어리가 된다. 이미 뽑은 것과
       충분히 떨어진 것만 남긴다. */
    if (out.some((p) => Math.abs(p[0] - avg[0]) + Math.abs(p[1] - avg[1]) + Math.abs(p[2] - avg[2]) < 60)) {
      continue;
    }
    out.push(avg);
    if (out.length >= want) break;
  }
  return out.map(([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
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
