/* 게임 스택 — 실제 출시작이 무엇으로 만들어졌는지.
   에셋을 사려는 사람이 제일 먼저 확인하는 건 "내 엔진에 붙나"다.
   ok=1 은 공개 자료로 확인된 것, 0 은 추정이다. 섞어 두면 자료가 아니다. */

export type Game = {
  n: string;
  eng: string;
  /** 1 이면 개발사가 공개한 사실, 0 이면 업계 추정 */
  ok: 0 | 1;
  yr: number;
  dev: string;
  cat: string;
  sc: string;
  rank?: number;
  /** [이름, 역할, 확인여부] */
  stack: [string, string, 0 | 1][];
};

export const GAME_CATS = [
  ["all", "전체"],
  ["steam", "스팀 상위"],
  ["mobile", "모바일"],
  ["indie", "인디"],
  ["kr", "국내"],
] as const;

export const SCALES: Record<string, string> = {
  aaa: "대형",
  team: "팀 단위",
  solo: "1인",
};

/* 엔진 표기를 계열과 버전으로 쪼갠다.
   로고는 계열에 붙고 버전은 글자로 남는다 — 그래야 점유도 세고 버전도 보인다.
   로고는 Wikimedia Commons 에서 받았고 라이선스는 아래 LOGO_LICENSE 에 적었다. */
export type EngineMark = { family: string; version: string; logo?: string };

const FAMILY: [RegExp, string, string | undefined][] = [
  [/^Unity/i, "Unity", "unity.svg"],
  [/^Unreal/i, "Unreal", "unreal.svg"],
  [/^Godot/i, "Godot", "godot.svg"],
  [/^GameMaker/i, "GameMaker", "gamemaker.png"],
  [/^MonoGame|^XNA/i, "MonoGame", "monogame.svg"],
  [/^Source/i, "Source", undefined],
  [/^Haxe|^Heaps|^OpenFL/i, "Haxe", undefined],
  [/^L[ÖO]VE/i, "LÖVE", undefined],
  [/^libGDX/i, "libGDX", undefined],
];

export function engineMark(name: string): EngineMark {
  for (const [re, family, logo] of FAMILY) {
    if (re.test(name)) {
      const version = name.replace(re, "").replace(/^[\s\-]*(Engine)?\s*/i, "").trim();
      return { family, version, logo };
    }
  }
  return { family: name, version: "" };
}

export const LOGO_LICENSE =
  "엔진 로고는 Wikimedia Commons 출처입니다. Unity, Unreal, GameMaker 는 퍼블릭 도메인, " +
  "Godot 는 CC0, MonoGame 은 MS-PL 입니다. 각 상표는 해당 소유자의 것이며 " +
  "게임이 그 엔진을 쓴다는 사실을 가리키는 용도로만 씁니다.";

export const GAMES: Game[] = [
    // ── 스팀 상위 (2026.07 Steam 인기 판매 차트 확인) ──
    { n: "Counter-Strike 2", eng: "Source 2", ok: 1, yr: 2023, dev: "Valve", cat: "steam", sc: "aaa", rank: 1,
      stack: [["Source 2", "엔진", 1], ["자체 툴체인", "제작", 1], ["Steam Workshop", "커뮤니티 에셋", 1]] },
    { n: "Dota 2", eng: "Source 2", ok: 1, yr: 2013, dev: "Valve", cat: "steam", sc: "aaa", rank: 2,
      stack: [["Source 2", "엔진", 1], ["Steam Workshop", "커뮤니티 에셋", 1], ["Panorama UI", "UI", 0]] },
    { n: "Palworld", eng: "Unreal Engine 5", ok: 1, yr: 2024, dev: "Pocketpair", cat: "steam", sc: "team", rank: 4,
      stack: [["Unreal Engine 5", "엔진", 1], ["Blueprint", "로직", 0], ["전용 서버", "네트워크", 0]] },
    { n: "Apex Legends", eng: "Source (개조)", ok: 1, yr: 2019, dev: "Respawn", cat: "steam", sc: "aaa", rank: 5,
      stack: [["Source (개조)", "엔진", 1], ["자체 애니메이션", "제작", 0]] },
    { n: "Marvel Rivals", eng: "Unreal Engine 5", ok: 1, yr: 2024, dev: "NetEase", cat: "steam", sc: "aaa", rank: 8,
      stack: [["Unreal Engine 5", "엔진", 1], ["Lumen , Nanite", "렌더", 0], ["Wwise", "오디오", 0]] },
    { n: "PUBG: BATTLEGROUNDS", eng: "Unreal Engine 4", ok: 1, yr: 2017, dev: "Krafton", cat: "steam", sc: "aaa", rank: 10,
      stack: [["Unreal Engine 4", "엔진", 1], ["관심영역 동기화", "네트워크", 0], ["FMOD", "오디오", 0]] },
    { n: "Assassin's Creed Black Flag Resynced", eng: "AnvilNext (자체)", ok: 0, yr: 2026, dev: "Ubisoft", cat: "steam", sc: "aaa", rank: 6,
      stack: [["AnvilNext 계열", "엔진", 0], ["자체 파이프라인", "제작", 0]] },
    { n: "Halo: Campaign Evolved", eng: "Unreal Engine 5", ok: 0, yr: 2026, dev: "Halo Studios", cat: "steam", sc: "aaa", rank: 3,
      stack: [["Unreal Engine 5", "엔진", 0], ["자체 에셋 이관", "제작", 0]] },
    { n: "Diablo IV", eng: "자체 엔진", ok: 1, yr: 2023, dev: "Blizzard", cat: "steam", sc: "aaa",
      stack: [["자체 엔진", "엔진", 1], ["사내 아트팀", "제작", 1]] },
    { n: "VALORANT", eng: "Unreal Engine 4", ok: 1, yr: 2020, dev: "Riot Games", cat: "steam", sc: "aaa",
      stack: [["Unreal Engine 4", "엔진", 1], ["자체 안티치트", "보안", 0], ["사내 아트팀", "제작", 1]] },

    // ── 인디 흥행작 ──
    { n: "Balatro", eng: "LÖVE 2D (Lua)", ok: 1, yr: 2024, dev: "LocalThunk", cat: "steam", sc: "solo",
      stack: [["LÖVE 2D", "엔진", 1], ["Lua", "언어", 1], ["자체 셰이더", "연출", 0]] },
    { n: "Dead Cells", eng: "Heaps (Haxe)", ok: 1, yr: 2018, dev: "Motion Twin", cat: "steam", sc: "team",
      stack: [["Heaps.io", "엔진", 1], ["Haxe", "언어", 1], ["LDtk", "레벨", 1], ["FMOD", "오디오", 0]] },
    { n: "Hollow Knight", eng: "Unity", ok: 1, yr: 2017, dev: "Team Cherry", cat: "steam", sc: "team",
      stack: [["Unity", "엔진", 1], ["PlayMaker", "로직", 1], ["Wwise", "오디오", 0]] },
    { n: "Celeste", eng: "MonoGame (XNA)", ok: 1, yr: 2018, dev: "Maddy Makes Games", cat: "steam", sc: "team",
      stack: [["MonoGame", "엔진", 1], ["C#", "언어", 1], ["Ogmo Editor", "레벨", 0]] },
    { n: "Undertale", eng: "GameMaker", ok: 1, yr: 2015, dev: "Toby Fox", cat: "steam", sc: "solo",
      stack: [["GameMaker", "엔진", 1], ["GML", "언어", 1], ["FL Studio", "음악", 0]] },
    { n: "Stardew Valley", eng: "MonoGame (XNA)", ok: 1, yr: 2016, dev: "ConcernedApe", cat: "steam", sc: "solo",
      stack: [["MonoGame", "엔진", 1], ["C#", "언어", 1], ["자체 타일 시스템", "레벨", 0]] },
    { n: "Lethal Company", eng: "Unity", ok: 1, yr: 2023, dev: "Zeekerss", cat: "steam", sc: "solo",
      stack: [["Unity", "엔진", 1], ["에셋스토어 조합", "아트", 1], ["근접 음성채팅", "시스템", 0]] },
    { n: "Vampire Survivors", eng: "Unity", ok: 0, yr: 2022, dev: "poncle", cat: "steam", sc: "solo",
      stack: [["Unity", "현재 엔진", 0], ["C#", "언어", 0], ["모바일 , 콘솔 동시 대응", "배포", 1]] },
    { n: "Slay the Spire", eng: "libGDX (Java)", ok: 1, yr: 2019, dev: "Mega Crit", cat: "steam", sc: "team",
      stack: [["libGDX", "엔진", 1], ["Java", "언어", 1], ["모드 API", "확장", 0]] },
    { n: "Cuphead", eng: "Unity", ok: 1, yr: 2017, dev: "Studio MDHR", cat: "steam", sc: "team",
      stack: [["Unity", "엔진", 1], ["수작업 셀 애니", "아트", 1]] },
    { n: "Valheim", eng: "Unity", ok: 1, yr: 2021, dev: "Iron Gate", cat: "steam", sc: "team",
      stack: [["Unity", "엔진", 1], ["절차적 지형", "레벨", 0]] },
    { n: "Terraria", eng: "XNA", ok: 1, yr: 2011, dev: "Re-Logic", cat: "steam", sc: "team",
      stack: [["XNA", "엔진", 1], ["C#", "언어", 1]] },
    { n: "Hades", eng: "자체 엔진", ok: 1, yr: 2020, dev: "Supergiant", cat: "steam", sc: "team",
      stack: [["자체 엔진", "엔진", 1], ["수작업 일러스트", "아트", 1], ["FMOD", "오디오", 0]] },
    { n: "Risk of Rain 2", eng: "Unity", ok: 1, yr: 2020, dev: "Hopoo Games", cat: "steam", sc: "team",
      stack: [["Unity", "엔진", 1], ["로우폴리 아트", "아트", 0]] },
    { n: "Cult of the Lamb", eng: "Unity", ok: 1, yr: 2022, dev: "Massive Monster", cat: "steam", sc: "team",
      stack: [["Unity", "엔진", 1], ["Spine", "2D 애니", 0]] },
    { n: "Katana ZERO", eng: "GameMaker", ok: 1, yr: 2019, dev: "Askiisoft", cat: "steam", sc: "team",
      stack: [["GameMaker", "엔진", 1], ["Aseprite", "도트", 0]] },
    { n: "Hyper Light Drifter", eng: "GameMaker", ok: 1, yr: 2016, dev: "Heart Machine", cat: "steam", sc: "team",
      stack: [["GameMaker", "엔진", 1], ["Aseprite", "도트", 0]] },
    { n: "Blasphemous", eng: "Unity", ok: 1, yr: 2019, dev: "The Game Kitchen", cat: "steam", sc: "team",
      stack: [["Unity", "엔진", 1], ["수작업 도트", "아트", 1]] },
    { n: "Tunic", eng: "Unity", ok: 1, yr: 2022, dev: "Andrew Shouldice", cat: "steam", sc: "solo",
      stack: [["Unity", "엔진", 1], ["로우폴리", "아트", 0]] },
    { n: "Papers, Please", eng: "Haxe / OpenFL", ok: 1, yr: 2013, dev: "Lucas Pope", cat: "steam", sc: "solo",
      stack: [["Haxe / OpenFL", "엔진", 1], ["자체 UI", "제작", 0]] },

    // ── 모바일 ──
    { n: "원신", eng: "Unity", ok: 1, yr: 2020, dev: "miHoYo", cat: "mobile", sc: "aaa",
      stack: [["Unity", "엔진", 1], ["자체 셰이더", "렌더", 0], ["Wwise", "오디오", 0]] },
    { n: "Among Us", eng: "Unity", ok: 1, yr: 2018, dev: "Innersloth", cat: "mobile", sc: "team",
      stack: [["Unity", "엔진", 1], ["단순 2D 아트", "아트", 0]] },
    { n: "Monument Valley", eng: "Unity", ok: 1, yr: 2014, dev: "ustwo games", cat: "mobile", sc: "team",
      stack: [["Unity", "엔진", 1], ["자체 착시 시스템", "제작", 0]] },
];
