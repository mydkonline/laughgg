import type { Knobs } from "../data/concepts";
import { paletteRgb, nearest, BAYER4 } from "../data/palettes";

/* 2D 변환 — 3D 렌더 한 장이든 원래 스프라이트든, 같은 여섯 노브로 민다.
   3D 쪽에서 조명과 재질이 하던 일을 여기서는 픽셀 값이 한다:

     분위기   → 밝기      (노출 대신 게인)
     색온도   → R/B 편향  (키라이트 색 대신 채널 이동)
     재질     → 대비      (반사 대신 밝은 쪽을 더 밝게)
     면 처리  → 포스터화  (flatShading 대신 색 계단 수)
     채도     → 채도
     외곽선   → 소벨 에지 (뒷면 사본 대신 윤곽 검출)

   그래서 같은 프리셋를 3D 로 보든 2D 로 뽑든 같은 느낌이 나온다. */

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

export type RasterOpts = {
  knobs: Knobs;
  /** 픽셀 한 칸의 크기. 1 이면 원본 해상도, 크면 도트가 굵어진다. */
  pixel: number;
  /** 강제할 팔레트. "free" 면 원본 색조를 그대로 둔다. */
  palette: string;
  /** 순서 디더링 세기 0–100. 팔레트가 좁을수록 이게 있어야 띠가 안 진다. */
  dither: number;
};

/** 노브에서 실제 계수를 뽑는다. 화면에 숫자로 보여줄 일이 있어 따로 뺐다. */
export function rasterParams(k: Knobs) {
  return {
    /* 3D 는 조명을 줄여 어둡게 한다 — 리라이트가 남아 형태가 보인다.
       2D 에서 같은 걸 곱셈으로 하면 그림자가 통째로 검게 뭉친다.
       감마로 눌러 중간톤만 내리고, 검은 바닥을 조금 들어 실루엣을 남긴다. */
    gamma: mix(0.74, 1.52, k.tone / 100),
    lift: mix(0, 30, k.tone / 100),
    warm: (k.warm - 50) / 50,
    contrast: mix(0.86, 1.34, k.gloss / 100),
    /** 색 계단 수. 각질수록 계단이 적어져 색이 뭉친다. */
    levels: Math.round(mix(48, 5, k.facet / 100)),
    sat: k.sat / 50,
    edge: k.line / 100,
  };
}

/**
 * 이미지 한 장을 노브대로 변환해 새 캔버스로 돌려준다.
 * 원본은 건드리지 않는다 — 같은 소스를 여러 설정으로 계속 다시 굽기 때문이다.
 */
export function rasterize(
  source: CanvasImageSource,
  width: number,
  height: number,
  { knobs, pixel, palette, dither }: RasterOpts,
): HTMLCanvasElement {
  const p = rasterParams(knobs);
  const step = Math.max(1, Math.round(pixel));

  /* 먼저 줄여 그린다. 줄여 놓고 처리해야 도트가 실제로 뭉치고,
     픽셀 수가 줄어 프레임마다 다시 굽는 비용도 같이 준다. */
  const w = Math.max(1, Math.round(width / step));
  const h = Math.max(1, Math.round(height / step));

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sc = small.getContext("2d", { willReadFrequently: true });
  if (!sc) return small;
  sc.imageSmoothingEnabled = step === 1;
  sc.drawImage(source, 0, 0, w, h);

  const img = sc.getImageData(0, 0, w, h);
  const d = img.data;

  /* 외곽선은 원본 밝기에서 뽑아야 한다. 색을 만진 뒤에 뽑으면
     포스터화 계단 자체가 에지로 잡혀 그물처럼 나온다. */
  const luma = p.edge > 0.01 ? new Float32Array(w * h) : null;
  if (luma) {
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      luma[j] = (d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114) / 255;
    }
  }

  const q = p.levels - 1;
  const pal = paletteRgb(palette);
  /* 디더 세기는 색 간격에 비례해야 한다. 팔레트가 넓으면 살짝만,
     게임보이 4색처럼 좁으면 세게 흩뿌려야 중간색이 생긴다. */
  const spread = (dither / 100) * (pal.length ? 255 / Math.max(2, pal.length) : 255 / p.levels);

  for (let i = 0; i < d.length; i += 4) {
    const px = (i >> 2) % w;
    const py = (i >> 2) / w | 0;
    const bias = spread > 0 ? BAYER4[py & 3]![px & 3]! * spread : 0;

    let r = d[i]!;
    let g = d[i + 1]!;
    let b = d[i + 2]!;

    r = 255 * Math.pow(r / 255, p.gamma);
    g = 255 * Math.pow(g / 255, p.gamma);
    b = 255 * Math.pow(b / 255, p.gamma);

    r = p.lift + (r * (255 - p.lift)) / 255;
    g = p.lift + (g * (255 - p.lift)) / 255;
    b = p.lift + (b * (255 - p.lift)) / 255;

    /* 색온도 — 따뜻하면 붉은 쪽을 올리고 푸른 쪽을 내린다 */
    r *= 1 + p.warm * 0.22;
    b *= 1 - p.warm * 0.22;

    /* 대비는 중간 밝기를 축으로 돌린다 */
    r = (r - 128) * p.contrast + 128;
    g = (g - 128) * p.contrast + 128;
    b = (b - 128) * p.contrast + 128;

    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = gray + (r - gray) * p.sat;
    g = gray + (g - gray) * p.sat;
    b = gray + (b - gray) * p.sat;

    /* 디더는 색을 끊기 직전에 섞는다. 끊고 나서 섞으면 계단이 그대로 남는다. */
    r += bias;
    g += bias;
    b += bias;

    if (pal.length) {
      /* 팔레트 고정 — 여기서 "이 게임의 색"이 된다 */
      const c = nearest(pal, clamp255(r), clamp255(g), clamp255(b));
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
    } else {
      /* 팔레트를 안 쓰면 색 계단만 줄인다 */
      d[i] = clamp255(Math.round((clamp255(r) / 255) * q) * (255 / q));
      d[i + 1] = clamp255(Math.round((clamp255(g) / 255) * q) * (255 / q));
      d[i + 2] = clamp255(Math.round((clamp255(b) / 255) * q) * (255 / q));
    }
  }

  /* 소벨 — 밝기가 급히 꺾이는 곳을 어둡게 덮는다.
     팔레트가 좁으면 살살 눌러야 한다. 게임보이 4색이나 1비트에서는 조금만 어둡혀도
     전부 제일 어두운 색으로 떨어져 그림이 통째로 검게 뭉친다. */
  if (luma) {
    const threshold = mix(0.42, 0.1, p.edge);
    const dark = pal.length && pal.length <= 4 ? 0.72 : 0.34;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const at = (yy: number, xx: number) => luma[yy * w + xx]!;
        const gx =
          -at(y - 1, x - 1) - 2 * at(y, x - 1) - at(y + 1, x - 1) +
          at(y - 1, x + 1) + 2 * at(y, x + 1) + at(y + 1, x + 1);
        const gy =
          -at(y - 1, x - 1) - 2 * at(y - 1, x) - at(y - 1, x + 1) +
          at(y + 1, x - 1) + 2 * at(y + 1, x) + at(y + 1, x + 1);
        if (Math.hypot(gx, gy) < threshold) continue;
        const i = (y * w + x) * 4;
        /* 완전히 검게 칠하지 않는다 — 원래 색을 남겨야 선이 배경에 녹는다 */
        d[i] = d[i]! * dark;
        d[i + 1] = d[i + 1]! * dark;
        d[i + 2] = d[i + 2]! * (dark + 0.04);
      }
    }
  }

  sc.putImageData(img, 0, 0);

  if (step === 1) return small;

  /* 다시 키운다. 보간을 끄지 않으면 애써 만든 도트가 도로 뭉개진다. */
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const oc = out.getContext("2d");
  if (!oc) return small;
  oc.imageSmoothingEnabled = false;
  oc.drawImage(small, 0, 0, width, height);
  return out;
}
