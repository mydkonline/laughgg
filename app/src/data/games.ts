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
  note: string;
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

export const GAMES: Game[] = [
    // ── 스팀 상위 (2026.07 Steam 인기 판매 차트 확인) ──
    { n: "Counter-Strike 2", eng: "Source 2", ok: 1, yr: 2023, dev: "Valve", cat: "steam", sc: "aaa", rank: 1,
      note: "스팀 인기 판매 1위. 자체 엔진 Source 2 기반이며, 무기 스킨은 커뮤니티 창작자가 만들고 Valve가 선별해 출시합니다.",
      stack: [["Source 2", "엔진", 1], ["자체 툴체인", "제작", 1], ["Steam Workshop", "커뮤니티 에셋", 1]] },
    { n: "Dota 2", eng: "Source 2", ok: 1, yr: 2013, dev: "Valve", cat: "steam", sc: "aaa", rank: 2,
      note: "커뮤니티 아이템 정산 비율 약 25%. 창작자 제작 아이템 파이프라인이 가장 오래 돌아가고 있는 사례입니다.",
      stack: [["Source 2", "엔진", 1], ["Steam Workshop", "커뮤니티 에셋", 1], ["Panorama UI", "UI", 0]] },
    { n: "Palworld", eng: "Unreal Engine 5", ok: 1, yr: 2024, dev: "Pocketpair", cat: "steam", sc: "team", rank: 4,
      note: "소규모 팀이 UE5로 오픈월드 멀티플레이를 출시했습니다. 엔진 기본 기능을 최대한 활용한 전략의 대표 사례입니다.",
      stack: [["Unreal Engine 5", "엔진", 1], ["Blueprint", "로직", 0], ["전용 서버", "네트워크", 0]] },
    { n: "Apex Legends", eng: "Source (개조)", ok: 1, yr: 2019, dev: "Respawn", cat: "steam", sc: "aaa", rank: 5,
      note: "타이탄폴 계열의 개조 Source 엔진을 사용합니다. 오래된 엔진도 깊게 개조하면 최신 게임을 낼 수 있음을 보여줍니다.",
      stack: [["Source (개조)", "엔진", 1], ["자체 애니메이션", "제작", 0]] },
    { n: "Marvel Rivals", eng: "Unreal Engine 5", ok: 1, yr: 2024, dev: "NetEase", cat: "steam", sc: "aaa", rank: 8,
      note: "UE5의 Lumen,Nanite를 적극 사용한 히어로 슈터입니다.",
      stack: [["Unreal Engine 5", "엔진", 1], ["Lumen , Nanite", "렌더", 0], ["Wwise", "오디오", 0]] },
    { n: "PUBG: BATTLEGROUNDS", eng: "Unreal Engine 4", ok: 1, yr: 2017, dev: "Krafton", cat: "steam", sc: "aaa", rank: 10,
      note: "100인 동시 접속을 위해 관심영역 기반 네트워크 동기화를 대규모로 구현했습니다.",
      stack: [["Unreal Engine 4", "엔진", 1], ["관심영역 동기화", "네트워크", 0], ["FMOD", "오디오", 0]] },
    { n: "Assassin's Creed Black Flag Resynced", eng: "AnvilNext (자체)", ok: 0, yr: 2026, dev: "Ubisoft", cat: "steam", sc: "aaa", rank: 6,
      note: "유비소프트 자체 엔진 계열입니다. 대형 스튜디오는 대개 자체 엔진을 유지합니다.",
      stack: [["AnvilNext 계열", "엔진", 0], ["자체 파이프라인", "제작", 0]] },
    { n: "Halo: Campaign Evolved", eng: "Unreal Engine 5", ok: 0, yr: 2026, dev: "Halo Studios", cat: "steam", sc: "aaa", rank: 3,
      note: "자체 Slipspace 엔진에서 언리얼로 이전한 것으로 알려져 있습니다. 자체 엔진 유지 비용이 커진 흐름을 보여줍니다.",
      stack: [["Unreal Engine 5", "엔진", 0], ["자체 에셋 이관", "제작", 0]] },
    { n: "Diablo IV", eng: "자체 엔진", ok: 1, yr: 2023, dev: "Blizzard", cat: "steam", sc: "aaa",
      note: "쿼터뷰 다크 판타지의 기준점입니다. 코스메틱은 전량 사내 제작이며 외부 창작자 파이프라인이 없습니다.",
      stack: [["자체 엔진", "엔진", 1], ["사내 아트팀", "제작", 1]] },
    { n: "VALORANT", eng: "Unreal Engine 4", ok: 1, yr: 2020, dev: "Riot Games", cat: "steam", sc: "aaa",
      note: "128틱 서버와 핑 보정에 많은 자원을 투입했습니다. 스킨은 전량 사내 제작입니다.",
      stack: [["Unreal Engine 4", "엔진", 1], ["자체 안티치트", "보안", 0], ["사내 아트팀", "제작", 1]] },

    // ── 인디 흥행작 ──
    { n: "Balatro", eng: "LÖVE 2D (Lua)", ok: 1, yr: 2024, dev: "LocalThunk", cat: "steam", sc: "solo",
      note: "1인 개발. 유니티도 언리얼도 아닌 Lua 프레임워크로 만들어졌습니다. 엔진이 흥행을 결정하지 않는다는 근거로 자주 인용됩니다.",
      stack: [["LÖVE 2D", "엔진", 1], ["Lua", "언어", 1], ["자체 셰이더", "연출", 0]] },
    { n: "Dead Cells", eng: "Heaps (Haxe)", ok: 1, yr: 2018, dev: "Motion Twin", cat: "steam", sc: "team",
      note: "자체 엔진을 만들며 레벨 에디터도 함께 만들었고, 그것이 나중에 LDtk로 공개되었습니다. 도구가 제품이 된 사례입니다.",
      stack: [["Heaps.io", "엔진", 1], ["Haxe", "언어", 1], ["LDtk", "레벨", 1], ["FMOD", "오디오", 0]] },
    { n: "Hollow Knight", eng: "Unity", ok: 1, yr: 2017, dev: "Team Cherry", cat: "steam", sc: "team",
      note: "3인 팀. 유니티 위에서 PlayMaker로 상당 부분의 로직을 구성한 것으로 알려져 있습니다.",
      stack: [["Unity", "엔진", 1], ["PlayMaker", "로직", 1], ["Wwise", "오디오", 0]] },
    { n: "Celeste", eng: "MonoGame (XNA)", ok: 1, yr: 2018, dev: "Maddy Makes Games", cat: "steam", sc: "team",
      note: "이동 감각 튜닝의 교과서입니다. 코요테 타임,점프 버퍼 개념이 대중화된 계기가 이 게임의 개발 공개글이었습니다.",
      stack: [["MonoGame", "엔진", 1], ["C#", "언어", 1], ["Ogmo Editor", "레벨", 0]] },
    { n: "Undertale", eng: "GameMaker", ok: 1, yr: 2015, dev: "Toby Fox", cat: "steam", sc: "solo",
      note: "사실상 1인 개발. 프로그래밍 배경이 깊지 않아도 완성작을 낼 수 있음을 보여준 사례입니다.",
      stack: [["GameMaker", "엔진", 1], ["GML", "언어", 1], ["FL Studio", "음악", 0]] },
    { n: "Stardew Valley", eng: "MonoGame (XNA)", ok: 1, yr: 2016, dev: "ConcernedApe", cat: "steam", sc: "solo",
      note: "1인 개발 4년. 코드,아트,음악,기획을 모두 혼자 맡았습니다.",
      stack: [["MonoGame", "엔진", 1], ["C#", "언어", 1], ["자체 타일 시스템", "레벨", 0]] },
    { n: "Lethal Company", eng: "Unity", ok: 1, yr: 2023, dev: "Zeekerss", cat: "steam", sc: "solo",
      note: "1인 개발 협동 호러. 에셋스토어 자원을 적극 조합해 만든 것으로 알려져 있습니다. 에셋 마켓의 실증 사례에 가깝습니다.",
      stack: [["Unity", "엔진", 1], ["에셋스토어 조합", "아트", 1], ["근접 음성채팅", "시스템", 0]] },
    { n: "Vampire Survivors", eng: "Unity", ok: 0, yr: 2022, dev: "poncle", cat: "steam", sc: "solo",
      note: "현재는 유니티 기반으로 운영됩니다. 초기 웹 프레임워크에서 출발했으나, 지금 스택 기준으로는 유니티 프로젝트입니다.",
      stack: [["Unity", "현재 엔진", 0], ["C#", "언어", 0], ["모바일 , 콘솔 동시 대응", "배포", 1]] },
    { n: "Slay the Spire", eng: "libGDX (Java)", ok: 1, yr: 2019, dev: "Mega Crit", cat: "steam", sc: "team",
      note: "덱빌딩 로그라이크 장르를 사실상 정의했습니다. 모드 친화적 구조가 수명을 크게 늘렸습니다.",
      stack: [["libGDX", "엔진", 1], ["Java", "언어", 1], ["모드 API", "확장", 0]] },
    { n: "Cuphead", eng: "Unity", ok: 1, yr: 2017, dev: "Studio MDHR", cat: "steam", sc: "team",
      note: "손그림 셀 애니메이션을 전부 프레임으로 그렸습니다. 아트 비용이 개발 기간을 결정한 대표 사례입니다.",
      stack: [["Unity", "엔진", 1], ["수작업 셀 애니", "아트", 1]] },
    { n: "Valheim", eng: "Unity", ok: 1, yr: 2021, dev: "Iron Gate", cat: "steam", sc: "team",
      note: "5인 팀. 저해상도 텍스처에 좋은 조명을 얹는 방향으로 아트 비용을 통제했습니다.",
      stack: [["Unity", "엔진", 1], ["절차적 지형", "레벨", 0]] },
    { n: "Terraria", eng: "XNA", ok: 1, yr: 2011, dev: "Re-Logic", cat: "steam", sc: "team",
      note: "10년 넘게 무료 업데이트를 이어간 사례입니다. 도트 기반 저해상도 아트가 수명을 늘렸습니다.",
      stack: [["XNA", "엔진", 1], ["C#", "언어", 1]] },
    { n: "Hades", eng: "자체 엔진", ok: 1, yr: 2020, dev: "Supergiant", cat: "steam", sc: "team",
      note: "자체 엔진을 유지하는 소규모 팀입니다. 아트 방향이 확고할 때 자체 엔진이 유리한 경우입니다.",
      stack: [["자체 엔진", "엔진", 1], ["수작업 일러스트", "아트", 1], ["FMOD", "오디오", 0]] },
    { n: "Risk of Rain 2", eng: "Unity", ok: 1, yr: 2020, dev: "Hopoo Games", cat: "steam", sc: "team",
      note: "2D에서 3D로 전환하며 원작의 감각을 유지한 드문 사례입니다.",
      stack: [["Unity", "엔진", 1], ["로우폴리 아트", "아트", 0]] },
    { n: "Cult of the Lamb", eng: "Unity", ok: 1, yr: 2022, dev: "Massive Monster", cat: "steam", sc: "team",
      note: "강한 아트 방향 하나로 두 장르를 묶어냈습니다. 스타일 통일이 곧 상품성이 된 사례입니다.",
      stack: [["Unity", "엔진", 1], ["Spine", "2D 애니", 0]] },
    { n: "Katana ZERO", eng: "GameMaker", ok: 1, yr: 2019, dev: "Askiisoft", cat: "steam", sc: "team",
      note: "도트 기반이지만 연출 밀도로 고급스러움을 만들어냈습니다.",
      stack: [["GameMaker", "엔진", 1], ["Aseprite", "도트", 0]] },
    { n: "Hyper Light Drifter", eng: "GameMaker", ok: 1, yr: 2016, dev: "Heart Machine", cat: "steam", sc: "team",
      note: "저해상도 도트에 색 대비만으로 분위기를 만든 대표작입니다.",
      stack: [["GameMaker", "엔진", 1], ["Aseprite", "도트", 0]] },
    { n: "Blasphemous", eng: "Unity", ok: 1, yr: 2019, dev: "The Game Kitchen", cat: "steam", sc: "team",
      note: "고밀도 도트 아트에 유니티를 결합했습니다. 도트가 반드시 저비용은 아님을 보여줍니다.",
      stack: [["Unity", "엔진", 1], ["수작업 도트", "아트", 1]] },
    { n: "Tunic", eng: "Unity", ok: 1, yr: 2022, dev: "Andrew Shouldice", cat: "steam", sc: "solo",
      note: "사실상 1인 개발. 아이소메트릭 로우폴리로 제작 부담을 줄였습니다.",
      stack: [["Unity", "엔진", 1], ["로우폴리", "아트", 0]] },
    { n: "Papers, Please", eng: "Haxe / OpenFL", ok: 1, yr: 2013, dev: "Lucas Pope", cat: "steam", sc: "solo",
      note: "1인 개발. 의도적으로 낮춘 해상도가 게임의 정체성이 되었습니다.",
      stack: [["Haxe / OpenFL", "엔진", 1], ["자체 UI", "제작", 0]] },

    // ── 모바일 ──
    { n: "원신", eng: "Unity", ok: 1, yr: 2020, dev: "miHoYo", cat: "mobile", sc: "aaa",
      note: "유니티로 만든 최대 규모 오픈월드 중 하나입니다. 모바일,PC,콘솔 동시 대응 파이프라인을 구축했습니다.",
      stack: [["Unity", "엔진", 1], ["자체 셰이더", "렌더", 0], ["Wwise", "오디오", 0]] },
    { n: "Among Us", eng: "Unity", ok: 1, yr: 2018, dev: "Innersloth", cat: "mobile", sc: "team",
      note: "출시 2년 뒤에 흥행한 사례입니다. 단순한 아트가 접근성을 높였습니다.",
      stack: [["Unity", "엔진", 1], ["단순 2D 아트", "아트", 0]] },
    { n: "Monument Valley", eng: "Unity", ok: 1, yr: 2014, dev: "ustwo games", cat: "mobile", sc: "team",
      note: "아트 자체가 게임 메커니즘인 사례입니다. 에셋 품질이 곧 상품성이었습니다.",
      stack: [["Unity", "엔진", 1], ["자체 착시 시스템", "제작", 0]] },
];
