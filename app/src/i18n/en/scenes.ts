import type { SceneGame } from "../../data/scenes";

/* 시연 씬 — 영어.

   195종 중 178종은 이미 영어 제목이라 표에 없다. 여기 있는 건 한국어
   제목으로 적힌 17종과 그 노트다. 게임 제목은 번역이 아니라 **공식 영문
   표기**를 쓴다 — 옮기면 검색이 안 된다.

   분류어(cat, sub)는 반복되는 말이라 `t()` 쪽 표에 있다. 여기는 레코드마다
   다른 것만 둔다. */
export const SCENES_EN: Record<string, Partial<SceneGame>> = {
  diablo4: { note: "One torch drives the contrast. Assets have to face that light too." },
  eldenring: { n: "Elden Ring", note: "Bleached daylight. Big silhouettes in a wide space." },
  ds3: { n: "Dark Souls III", note: "Grey-brown under ash and dust. Pull the saturation down to fit." },
  bg3: { n: "Baldur's Gate 3", note: "Balanced light for an isometric RPG. Several characters have to read at once." },
  tlou: {
    n: "The Last of Us",
    note: "Bleached green-grey. One window is the key light, so props should face it.",
  },
  pubg: { n: "PUBG: Battlegrounds", note: "Realistic exposure with almost no grading." },
  cyberpunk: {
    n: "Cyberpunk 2077",
    note: "Two neons pushing against each other. Assets need both laid over them.",
  },
  valheim: { n: "Valheim", note: "Heavy fog builds the depth. The further back, the hazier it should read." },
  darkeden: {
    n: "Dark Eden",
    note: "Not on Steam, so no official screenshot — swapped for a CC0 isometric ruin in the same vein.",
  },
  hollow: {
    n: "Hollow Knight",
    note: "Teal glow against deep dark. Only a sharp silhouette survives it.",
  },
  hades: {
    n: "Hades",
    note: "Red light, high saturation. Isometric down-view, so what is underfoot has to show.",
  },
  deadcells: { n: "Dead Cells", note: "High-resolution pixels. The pixels stay crisp but the light is soft." },
  stardew: { n: "Stardew Valley", note: "Bright, warm, low-res pixels. Dark assets float on top." },
  terraria: { n: "Terraria", note: "Small pixels. Mismatch the asset resolution and it shows immediately." },
  ori: { n: "Ori and the Blind Forest", note: "A painted background with a glowing lead. The contrast is wide." },
  sts: {
    n: "Slay the Spire",
    note: "The card UI takes the bottom of the screen. Characters split left and right.",
  },
};
