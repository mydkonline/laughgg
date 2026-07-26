/* 게임별 화풍. 같은 에셋을 각 게임의 조명과 색 보정 아래 놓아 본다.
   사려는 사람이 제일 먼저 하는 판단이 "우리 게임에 놔도 되나" 라서,
   그 판단을 글이 아니라 그림으로 하게 만드는 화면이다.

   숫자는 전부 실제 렌더에 걸린다 — grade 는 CSS 필터, light 는 방사형 그라디언트,
   fog 는 바탕색, vig 는 비네팅, place 는 에셋을 놓는 좌표다. */

export type Grade = { br: number; ct: number; sat: number; hue: number; sep: number };
export type Light = { x: number; y: number; r: number; c: [number, number, number]; i: number };
/** 에셋을 놓을 자리. x, y 는 화면 비율, s 는 크기 배수, r 은 회전 각도다. */
export type Place = { key: string; x: number; y: number; s: number; r: number };

/* 대분류는 시각 방향, 소분류는 분위기와 테마다. 업계 통용 분류를 그대로 따른다 —
   사실적 / 준사실적 / 스타일라이즈 위에 분위기 라벨이 얹히는 구조다. */
export const ART_CATS = ["사실적", "준사실적", "스타일라이즈"] as const;
export type ArtCat = (typeof ART_CATS)[number];

export type SceneGame = {
  id: string;
  /** 시각 방향 */
  cat: ArtCat;
  /** 분위기와 테마 */
  sub: string;
  n: string;
  dim: "3D" | "2D";
  pool: string;
  grade: Grade;
  light: Light[];
  /** 바탕 안개 색 */
  fog: [number, number, number];
  /** 비네팅 세기 */
  vig: number;
  grain: number;
  place: Place[];
  note: string;
  /** 목록 칩에 쓰는 대표색 */
  sw: string;
  /** 청록 쪽으로 미는 정도. 없으면 0 */
  teal?: number;
};

export const SCENE_GAMES: SceneGame[] = [
  {
    id: "diablo4", cat: "준사실적", sub: "다크 판타지", n: "Diablo IV", dim: "3D", pool: "iso",
    grade: {br:.86,ct:1.22,sat:.74,hue:-6,sep:.10},
    light: [{x:.30,y:.46,r:.58,c:[255,148,60],i:.50},{x:.74,y:.60,r:.44,c:[255,120,40],i:.34}],
    fog: [26,14,8], vig: .72, grain: .04,
    place: [{ key: "s-character-human", x: .40, y: .72, s: 1.05, r: 0 },{ key: "s-weapon-sword", x: .53, y: .66, s: .9, r: -24 },{ key: "s-barrel", x: .76, y: .78, s: .8, r: 0 }],
    note: "횃불 하나가 지배하는 강한 명암. 에셋도 그 광원 방향을 따라야 합니다.", sw: "#8a3018",
  },
  {
    id: "eldenring", cat: "준사실적", sub: "다크 판타지", n: "엘든 링", dim: "3D", pool: "iso",
    grade: {br:.94,ct:1.14,sat:.72,hue:4,sep:.08},
    light: [{x:.56,y:.28,r:.86,c:[236,220,180],i:.36}],
    fog: [58,54,44], vig: .62, grain: .03,
    place: [{ key: "s-character-human", x: .34, y: .74, s: 1.1, r: 0 },{ key: "s-weapon-spear", x: .47, y: .66, s: 1.0, r: -18 },{ key: "s-column", x: .80, y: .66, s: 1.0, r: 0 }],
    note: "탈색된 자연광. 넓은 공간에 실루엣이 크게 놓입니다.", sw: "#8a7a4a",
  },
  {
    id: "ds3", cat: "준사실적", sub: "다크 판타지", n: "다크 소울 3", dim: "3D", pool: "iso",
    grade: {br:.80,ct:1.28,sat:.62,hue:-2,sep:.14},
    light: [{x:.44,y:.34,r:.66,c:[255,190,120],i:.40}],
    fog: [34,30,26], vig: .80, grain: .05,
    place: [{ key: "s-character-human", x: .36, y: .76, s: 1.0, r: 0 },{ key: "s-weapon-sword", x: .49, y: .68, s: .92, r: -28 },{ key: "s-shield-round", x: .26, y: .70, s: .72, r: 10 }],
    note: "재와 먼지가 낀 회갈색. 채도를 낮춰야 어울립니다.", sw: "#6a5a48",
  },
  {
    id: "bg3", cat: "준사실적", sub: "하이 판타지", n: "발더스 게이트 3", dim: "3D", pool: "iso",
    grade: {br:1.02,ct:1.08,sat:.92,hue:2,sep:.04},
    light: [{x:.50,y:.26,r:.90,c:[255,232,200],i:.40}],
    fog: [64,60,54], vig: .48, grain: .02,
    place: [{ key: "s-character-human", x: .38, y: .72, s: 1.0, r: 0 },{ key: "s-character-orc", x: .62, y: .70, s: .95, r: 0 },{ key: "s-chest", x: .78, y: .78, s: .8, r: 0 }],
    note: "쿼터뷰 RPG의 균형 잡힌 조명. 여러 캐릭터가 함께 읽혀야 합니다.", sw: "#7a6a9a",
  },
  {
    id: "tlou", cat: "사실적", sub: "포스트 아포칼립스", n: "라스트 오브 어스", dim: "3D", pool: "real",
    grade: {br:.94,ct:1.16,sat:.66,hue:-4,sep:.08},
    light: [{x:.68,y:.30,r:.74,c:[214,226,214],i:.34},{x:.22,y:.58,r:.32,c:[255,196,130],i:.16}],
    fog: [46,52,44], vig: .66, grain: .05,
    place: [{ key: "rp-wooden_crate_02", x: .34, y: .76, s: 1.0, r: 0 },{ key: "rp-steel_frame_shelves_01", x: .68, y: .66, s: 1.1, r: 0 }],
    note: "탈색된 녹회색. 창광 하나가 주광원이라 소품도 그쪽을 향해야 합니다.", sw: "#6a7a5a", teal: .16,
  },
  {
    id: "pubg", cat: "사실적", sub: "밀리터리", n: "배틀그라운드", dim: "3D", pool: "real",
    grade: {br:1.0,ct:1.10,sat:.86,hue:0,sep:.02},
    light: [{x:.50,y:.22,r:.92,c:[255,246,230],i:.34}],
    fog: [80,84,86], vig: .44, grain: .02,
    place: [{ key: "rp-wooden_crate_02", x: .30, y: .78, s: 1.0, r: 0 },{ key: "rp-steel_frame_shelves_01", x: .72, y: .70, s: 1.0, r: 0 }],
    note: "색 보정이 거의 없는 사실적 노출.", sw: "#8a8a7a",
  },
  {
    id: "cyberpunk", cat: "사실적", sub: "사이버펑크", n: "사이버펑크 2077", dim: "3D", pool: "scifi",
    grade: {br:.96,ct:1.20,sat:1.24,hue:8,sep:0},
    light: [{x:.30,y:.40,r:.60,c:[255,80,200],i:.44},{x:.72,y:.46,r:.56,c:[80,220,255],i:.40}],
    fog: [30,20,44], vig: .60, grain: .04,
    place: [{ key: "sf-unit01", x: .36, y: .74, s: 1.0, r: 0 },{ key: "sf-struct01", x: .70, y: .66, s: 1.1, r: 0 }],
    note: "네온 두 색이 서로를 밀어냅니다. 에셋에도 두 색이 얹혀야 합니다.", sw: "#d040c0",
  },
  {
    id: "valheim", cat: "스타일라이즈", sub: "로우폴리 판타지", n: "발헤임", dim: "3D", pool: "iso",
    grade: {br:1.04,ct:.96,sat:.84,hue:-6,sep:.05},
    light: [{x:.40,y:.30,r:.88,c:[255,226,176],i:.30}],
    fog: [154,168,160], vig: .36, grain: .02,
    place: [{ key: "s-character-human", x: .38, y: .74, s: 1.0, r: 0 },{ key: "s-banner", x: .70, y: .66, s: 1.0, r: 0 },{ key: "s-barrel", x: .60, y: .80, s: .8, r: 0 }],
    note: "짙은 안개가 거리감을 만듭니다. 멀리 놓을수록 흐려져야 자연스럽습니다.", sw: "#6d8a5a",
  },
  {
    id: "darkeden", cat: "스타일라이즈", sub: "고딕 도트", n: "다크에덴", dim: "2D", pool: "pixel",
    grade: {br:.92,ct:1.08,sat:.72,hue:24,sep:0},
    light: [{x:.60,y:.18,r:.80,c:[150,165,255],i:.46},{x:.26,y:.52,r:.38,c:[178,120,255],i:.28}],
    fog: [26,20,48], vig: .56, grain: .03,
    place: [{ key: "px-char1", x: .40, y: .70, s: 1.0, r: 0 },{ key: "px-mon1", x: .66, y: .66, s: 1.0, r: 0 },{ key: "px-item1", x: .52, y: .78, s: .8, r: 0 }],
    note: "Steam 미출시라 공식 스크린샷을 쓸 수 없어, 같은 계열의 CC0 아이소메트릭 폐허로 대체했습니다.", sw: "#7a5ac0",
  },
  {
    id: "hollow", cat: "스타일라이즈", sub: "핸드드로운", n: "할로우 나이트", dim: "2D", pool: "pixel",
    grade: {br:.86,ct:1.24,sat:.70,hue:120,sep:.04},
    light: [{x:.48,y:.32,r:.66,c:[90,220,235],i:.36}],
    fog: [10,26,32], vig: .70, grain: .03,
    place: [{ key: "px-char2", x: .38, y: .72, s: 1.0, r: 0 },{ key: "px-mon3", x: .68, y: .68, s: 1.0, r: 0 }],
    note: "청록 발광과 깊은 어둠. 실루엣이 또렷해야 살아남습니다.", sw: "#2f7f8f",
  },
  {
    id: "hades", cat: "스타일라이즈", sub: "코믹 일러스트", n: "하데스", dim: "2D", pool: "pixel",
    grade: {br:1.02,ct:1.14,sat:1.16,hue:-6,sep:0},
    light: [{x:.46,y:.38,r:.70,c:[255,150,90],i:.40}],
    fog: [40,20,30], vig: .56, grain: .02,
    place: [{ key: "px-char3", x: .38, y: .72, s: 1.0, r: 0 },{ key: "px-mon1", x: .66, y: .68, s: 1.0, r: 0 },{ key: "px-item5", x: .54, y: .80, s: .8, r: 0 }],
    note: "붉은 조명에 채도가 높습니다. 아이소메트릭 부감이라 발밑이 보여야 합니다.", sw: "#c85a3a",
  },
  {
    id: "deadcells", cat: "스타일라이즈", sub: "픽셀 아트", n: "데드 셀", dim: "2D", pool: "pixel",
    grade: {br:.96,ct:1.18,sat:1.02,hue:10,sep:0},
    light: [{x:.42,y:.36,r:.68,c:[120,220,255],i:.34}],
    fog: [22,28,40], vig: .60, grain: .02,
    place: [{ key: "px-char1", x: .36, y: .74, s: 1.0, r: 0 },{ key: "px-item2", x: .50, y: .68, s: .9, r: -20 }],
    note: "고해상도 도트. 픽셀이 살아 있으면서도 조명은 부드럽습니다.", sw: "#4a9ad0",
  },
  {
    id: "stardew", cat: "스타일라이즈", sub: "코지 픽셀", n: "스타듀 밸리", dim: "2D", pool: "pixel",
    grade: {br:1.10,ct:1.02,sat:1.10,hue:0,sep:0},
    light: [{x:.50,y:.24,r:.92,c:[255,244,200],i:.30}],
    fog: [180,200,170], vig: .24, grain: 0,
    place: [{ key: "px-char2", x: .40, y: .72, s: 1.0, r: 0 },{ key: "px-item4", x: .58, y: .76, s: .8, r: 0 }],
    note: "밝고 따뜻한 저해상도 도트. 어두운 에셋은 겉돕니다.", sw: "#8ac06a",
  },
  {
    id: "terraria", cat: "스타일라이즈", sub: "픽셀 아트", n: "테라리아", dim: "2D", pool: "pixel",
    grade: {br:1.0,ct:1.10,sat:1.06,hue:0,sep:0},
    light: [{x:.46,y:.34,r:.74,c:[255,220,160],i:.32}],
    fog: [40,36,50], vig: .50, grain: 0,
    place: [{ key: "px-char1", x: .38, y: .72, s: 1.0, r: 0 },{ key: "px-item1", x: .52, y: .68, s: .9, r: -16 }],
    note: "작은 도트. 에셋 해상도를 맞추지 않으면 바로 티가 납니다.", sw: "#7aa0c0",
  },
  {
    id: "cuphead", cat: "스타일라이즈", sub: "러버호스 애니", n: "컵헤드", dim: "2D", pool: "pixel",
    grade: {br:1.14,ct:1.06,sat:1.06,hue:6,sep:.16},
    light: [{x:.50,y:.30,r:.90,c:[255,240,210],i:.28}],
    fog: [220,200,160], vig: .30, grain: .06,
    place: [{ key: "px-char3", x: .38, y: .72, s: 1.0, r: 0 },{ key: "px-mon3", x: .66, y: .68, s: 1.0, r: 0 }],
    note: "1930년대 셀 애니. 종이 질감과 세피아가 특징입니다.", sw: "#c8a050",
  },
  {
    id: "ori", cat: "스타일라이즈", sub: "회화적", n: "오리", dim: "2D", pool: "pixel",
    grade: {br:1.06,ct:1.10,sat:1.20,hue:-8,sep:0},
    light: [{x:.44,y:.32,r:.80,c:[150,230,255],i:.42}],
    fog: [30,60,80], vig: .52, grain: .02,
    place: [{ key: "px-char3", x: .38, y: .72, s: 1.0, r: 0 },{ key: "px-item6", x: .58, y: .66, s: .8, r: 0 }],
    note: "회화적인 배경에 발광하는 주인공. 대비가 큽니다.", sw: "#5ac0d8",
  },
  {
    id: "sts", cat: "스타일라이즈", sub: "코믹 일러스트", n: "슬레이 더 스파이어", dim: "2D", pool: "pixel",
    grade: {br:1.0,ct:1.10,sat:.96,hue:0,sep:.04},
    light: [{x:.50,y:.30,r:.86,c:[255,220,180],i:.30}],
    fog: [40,32,44], vig: .48, grain: .02,
    place: [{ key: "px-char2", x: .30, y: .70, s: 1.0, r: 0 },{ key: "px-mon1", x: .70, y: .68, s: 1.1, r: 0 }],
    note: "카드 UI가 화면 하단을 차지합니다. 캐릭터는 좌우로 갈립니다.", sw: "#a06a4a",
  },
];

/** 시연에 쓸 실제 모델. 원본의 스프라이트 키 대신 마켓 상품을 건다. */
export const PLACE_MODEL: Record<string, string> = {
  "s-character-human": "gothic_statue",
  "s-character-orc": "horse_statue_01",
  "s-weapon-sword": "kite_shield",
  "s-weapon-spear": "cross_pein_hammer",
  "s-shield-round": "kite_shield",
  "s-barrel": "barrel_03",
  "s-chest": "GothicCabinet_01",
  "s-column": "gothic_statue",
  "rp-wooden_crate_02": "barrel_03",
  "rp-steel_frame_shelves_01": "WoodenTable_02",
};


/* 산 에셋이 이 게임에 맞는가.

   에셋은 스튜디오 조명 아래 중립으로 구워져 있다. 게임이 요구하는 값과의 차이를
   축마다 재면 어디가 어긋나는지 나온다. 눈으로 보기 전에 숫자로 먼저 알려 준다.

   기준은 중립값이다 — 밝기 1, 대비 1, 채도 1, 색조 0. 구운 그대로의 상태다. */
export type FitAxis = {
  label: string;
  /** 이 게임이 요구하는 값 */
  want: string;
  /** 중립에서 얼마나 떨어져 있나. 0~1 */
  gap: number;
  /** 무엇을 고쳐야 하나 */
  fix: string;
};

export type FitReport = {
  score: number;
  axes: FitAxis[];
};

export function fitReport(g: SceneGame): FitReport {
  const { grade } = g;
  const axes: FitAxis[] = [
    {
      label: "밝기",
      want: grade.br.toFixed(2),
      gap: Math.min(1, Math.abs(1 - grade.br) / 0.4),
      fix: grade.br < 1 ? "노출을 낮춰야 합니다" : "노출을 올려야 합니다",
    },
    {
      label: "대비",
      want: grade.ct.toFixed(2),
      gap: Math.min(1, Math.abs(1 - grade.ct) / 0.4),
      fix: grade.ct > 1 ? "명암을 강하게 벌려야 합니다" : "명암을 눌러야 합니다",
    },
    {
      label: "채도",
      want: grade.sat.toFixed(2),
      gap: Math.min(1, Math.abs(1 - grade.sat) / 0.5),
      fix: grade.sat < 1 ? "색을 빼야 합니다" : "색을 올려야 합니다",
    },
    {
      label: "색조",
      want: `${grade.hue > 0 ? "+" : ""}${grade.hue}°`,
      gap: Math.min(1, Math.abs(grade.hue) / 12),
      fix: grade.hue < 0 ? "차가운 쪽으로 돌려야 합니다" : "따뜻한 쪽으로 돌려야 합니다",
    },
    {
      label: "세피아",
      want: grade.sep.toFixed(2),
      gap: Math.min(1, grade.sep / 0.2),
      fix: "탈색 톤을 입혀야 합니다",
    },
  ];
  /* 어긋난 정도의 평균을 100점에서 뺀다. 축 하나가 크게 튀면 그만큼 내려간다. */
  const avg = axes.reduce((a, x) => a + x.gap, 0) / axes.length;
  return { score: Math.round(100 - avg * 62), axes };
}

/** 조정 없이 써도 되는가. 60 아래면 손봐야 한다. */
export function fitVerdict(score: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (score >= 80) return { label: "그대로 사용 가능", tone: "ok" };
  if (score >= 60) return { label: "부분 조정 필요", tone: "warn" };
  return { label: "조정 없이는 안 맞음", tone: "bad" };
}
