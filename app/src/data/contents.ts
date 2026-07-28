import { t } from "../lib/locale";
import type { Piece } from "./pieces";

/* 패키지 콘텐츠 — 사기 전에 안에 뭐가 들었는지 본다.
   Unity Asset Store 가 이걸 탭으로 빼 둔 이유가 있다. 상품 설명은 파는 쪽 말이고,
   파일 목록은 사는 쪽이 직접 확인할 수 있는 유일한 것이다.

   시연 단계라 실제 아카이브가 없으니 상품 특성에서 만들어 낸다. 대신 id 를 씨앗으로
   써서 같은 상품은 항상 같은 목록이 나온다 — 새로고침마다 바뀌면 자료가 아니다. */

export type Entry = {
  name: string;
  /** 폴더면 하위 목록, 파일이면 없다 */
  children?: Entry[];
  /** 확장자 없는 폴더는 비운다 */
  ext?: string;
  /** 바이트 */
  size?: number;
  note?: string;
};

export type PackageTree = {
  folders: Entry[];
  files: number;
  bytes: number;
};

const KB = 1024;
const MB = 1024 * KB;

/** 파일 크기 표기. 소수 한 자리면 충분하다. */
export function bytes(n: number): string {
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  if (n >= KB) return `${Math.round(n / KB)} KB`;
  return `${n} B`;
}

/* 상품마다 다르되 항상 같은 값이 나오는 난수. id 를 씨앗으로 쓴다. */
function seeded(id: number, salt: number, lo: number, hi: number): number {
  const v = Math.abs(Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453) % 1;
  return lo + Math.floor(v * (hi - lo + 1));
}

const TEX_BYTES: Record<string, number> = { "1K": 1.4 * MB, "2K": 5.2 * MB, "4K": 19 * MB };

function count(e: Entry): number {
  return e.children ? e.children.reduce((a, c) => a + count(c), 0) : 1;
}

function weigh(e: Entry): number {
  return e.children ? e.children.reduce((a, c) => a + weigh(c), 0) : (e.size ?? 0);
}

/** 상품 하나의 패키지 구성. 3D 와 2D 는 들어가는 폴더가 다르다. */
export function packageTree(p: Piece): PackageTree {
  const is3d = Boolean(p.m);
  const texUnit = TEX_BYTES[p.tex] ?? 1.4 * MB;
  const lods = seeded(p.id, 1, 2, 4);
  const variants = seeded(p.id, 2, 2, 6);
  const base = p.t.replace(/\s+/g, "_");

  const folders: Entry[] = is3d
    ? [
        {
          name: "Meshes",
          children: Array.from({ length: lods }, (_, i) => ({
            name: `${base}_LOD${i}`,
            ext: "fbx",
            size: seeded(p.id, 10 + i, 240, 900) * KB,
            /* 숫자가 말 안에 박혀 있어서 통째로 키가 될 수 없다. 자리를 비워 두고
               번역표가 그 자리를 채운다. */
            note: i === 0 ? t("원본") : t("{n}% 면 수", { n: 100 - i * 28 }),
          })),
        },
        {
          name: "Textures",
          children: (["albedo", "normal", "roughness", "ao"] as const).map((kind) => ({
            name: `${base}_${kind}`,
            ext: "png",
            size: Math.round(texUnit * (kind === "normal" ? 1.3 : 1)),
            note: p.tex,
          })),
        },
        {
          name: "Materials",
          children: Array.from({ length: variants }, (_, i) => ({
            name: `${base}_M${String(i + 1).padStart(2, "0")}`,
            ext: "mat",
            size: seeded(p.id, 30 + i, 3, 12) * KB,
          })),
        },
        {
          name: "Prefabs",
          children: Array.from({ length: variants }, (_, i) => ({
            name: `${base}_${String(i + 1).padStart(2, "0")}`,
            ext: "prefab",
            size: seeded(p.id, 50 + i, 8, 40) * KB,
          })),
        },
      ]
    : [
        {
          name: "Sprites",
          children: Array.from({ length: seeded(p.id, 3, 12, 48) }, (_, i) => ({
            name: `${base}_${String(i + 1).padStart(3, "0")}`,
            ext: "png",
            size: seeded(p.id, 70 + i, 4, 30) * KB,
          })),
        },
        {
          name: "Atlas",
          children: [
            { name: `${base}_atlas`, ext: "png", size: 2.1 * MB, note: "2048" },
            { name: `${base}_atlas`, ext: "json", size: 18 * KB, note: "좌표" },
          ],
        },
        {
          name: "Animations",
          children: Array.from({ length: seeded(p.id, 4, 2, 6) }, (_, i) => ({
            name: `${base}_anim_${i + 1}`,
            ext: "anim",
            size: seeded(p.id, 90 + i, 6, 24) * KB,
          })),
        },
      ];

  folders.push(
    {
      name: "Demo",
      children: [
        { name: "Showcase", ext: "unity", size: 120 * KB, note: "시연 씬" },
        { name: "SetupCamera", ext: "cs", size: 4 * KB },
      ],
    },
    {
      name: "Documentation",
      children: [
        { name: "README", ext: "md", size: 9 * KB },
        { name: "LICENSE", ext: "txt", size: 2 * KB, note: "CC0" },
        { name: "SOURCES", ext: "md", size: 5 * KB, note: "재료 출처" },
      ],
    },
  );

  return {
    folders,
    files: folders.reduce((a, f) => a + count(f), 0),
    bytes: folders.reduce((a, f) => a + weigh(f), 0),
  };
}
