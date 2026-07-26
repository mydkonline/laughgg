/* 마켓 상품 — 전부 CC0 다. 출처는 저장소 루트 CREDITS.md 에 있다.
   m 은 Poly Haven glTF 모델 이름, img 는 도트 스프라이트 파일 이름이다. */
export type Piece = {
  id: number;
  /** Poly Haven glTF 모델. 도트 상품에는 없다. */
  m?: string;
  /** 도트 스프라이트. 3D 상품에는 없다. */
  img?: string;
  t: string;
  by: string;
  cat: CatKey;
  eng: EngineKey[];
  score: number;
  feel: number;
  price: number;
  dl: number;
  days: number;
  tri: string;
  tex: string;
  desc: string;
};

export const CATS = [
  ["all", "전체"],
  ["env", "환경 · 구조물"],
  ["weapon", "무기 · 방어구"],
  ["char", "캐릭터 · 도트"],
  ["prop", "소품"],
  ["light", "조명"],
  ["furniture", "가구"],
  ["tex", "재질"],
] as const;

export type CatKey = (typeof CATS)[number][0];
export const CAT_NAME = Object.fromEntries(CATS) as Record<CatKey, string>;

export const ENGINES = ["unity", "unreal", "godot"] as const;
export type EngineKey = (typeof ENGINES)[number];
export const ENGINE_NAME: Record<EngineKey, string> = {
  unity: "UNITY",
  unreal: "UNREAL",
  godot: "GODOT",
};

/** 검수 7항목 중 상세에 노출하는 여섯. 라이선스 출처가 60 미만이면 무조건 탈락한다. */
export const CHECKS = [
  { k: "에셋 무결성", d: "토폴로지 · UV · LOD" },
  { k: "런타임 성능", d: "실측 프레임 영향" },
  { k: "라이선스 출처", d: "학습 소스 추적" },
  { k: "코드 품질", d: "결합도 · 테스트" },
  { k: "통합 난이도", d: "붙이는 데 걸리는 시간" },
  { k: "게임 필", d: "입력 반응 · 연출 타이밍" },
] as const;

export const PIECES: Piece[] = [
    { id:1,  m:"gothic_statue",         t:"Gothic Statue",        by:"stonewright", cat:"env",       eng:["unity","unreal"],        score:94, feel:91, price:38, dl:2140, days:2,  tri:"18.4k", tex:"1K", desc:"성당 정면에 놓는 석상. 노멀맵으로 조각 디테일을 담아 폴리곤을 아꼈고, 정면·측면 실루엣이 모두 살아 있습니다." },
    { id:2,  m:"kite_shield",           t:"Kite Shield",          by:"ironbark",    cat:"weapon",    eng:["unity","unreal","godot"], score:92, feel:89, price:24, dl:3820, days:4,  tri:"4.2k",  tex:"1K", desc:"가죽 띠와 금속 보스가 분리된 머티리얼로 들어갑니다. 손에 쥐는 각도에서 두께가 자연스럽게 보이도록 옆면을 살렸습니다." },
    { id:3,  m:"lantern_chandelier_01", t:"Lantern Chandelier",   by:"emberforge",  cat:"light",     eng:["unity","unreal"],        score:91, feel:88, price:32, dl:1680, days:1,  tri:"22.1k", tex:"1K", desc:"천장에 매다는 랜턴형 샹들리에. 유리 부분이 별도 머티리얼이라 안쪽 광원을 그대로 통과시킵니다." },
    { id:4,  m:"brass_candleholders",   t:"Brass Candleholders",  by:"emberforge",  cat:"light",     eng:["unity"],                 score:90, feel:87, price:18, dl:2960, days:3,  tri:"9.8k",  tex:"1K", desc:"5구 황동 촛대. 금속 러프니스가 부위별로 달라 촛농 자국이 남은 아랫부분이 무광으로 보입니다." },
    { id:5,  m:"cross_pein_hammer",     t:"Cross Pein Hammer",    by:"ironbark",    cat:"weapon",    eng:["unreal","godot"],        score:88, feel:86, price:12, dl:4410, days:6,  tri:"3.1k",  tex:"1K", desc:"대장간 소품이자 근접 무기로 쓸 수 있는 망치. 나무 자루의 결과 쇠머리의 마모가 텍스처에 들어 있습니다." },
    { id:6,  m:"Lantern_01",            t:"Lantern 01",           by:"emberforge",  cat:"light",     eng:["unity","unreal"],        score:87, feel:85, price:16, dl:5230, days:2,  tri:"7.4k",  tex:"1K", desc:"손에 드는 등불. 유리·황동·심지가 각각 머티리얼로 나뉘어 있어 불빛만 따로 제어할 수 있습니다." },
    { id:7,  m:"horse_statue_01",       t:"Horse Statue",         by:"stonewright", cat:"env",       eng:["unity","unreal"],        score:85, feel:83, price:34, dl:1120, days:9,  tri:"26.7k", tex:"1K", desc:"광장 중앙에 놓는 기마상. 받침대까지 한 메시라 배치가 간단하고, 뒤쪽도 마감돼 있어 어느 각도에서든 씁니다." },
    { id:8,  m:"brass_goblets",         t:"Brass Goblets",        by:"tinsmith",    cat:"prop",      eng:["unity"],                 score:84, feel:82, price:9,  dl:6740, days:5,  tri:"5.6k",  tex:"1K", desc:"연회 테이블용 잔 세트. 세 가지 형태가 한 파일에 들어 있어 나눠 배치하면 손으로 놓은 것처럼 보입니다." },
    { id:9,  m:"GothicCabinet_01",      t:"Gothic Cabinet",       by:"oakmoor",     cat:"furniture", eng:["unity","unreal"],        score:83, feel:80, price:28, dl:1490, days:7,  tri:"14.2k", tex:"1K", desc:"문이 열리는 고딕 장식장. 문짝이 별도 오브젝트라 애니메이션을 붙일 수 있습니다." },
    { id:10, m:"bronze_whale_statue",   t:"Bronze Statue",        by:"stonewright", cat:"env",       eng:["unreal"],                score:82, feel:79, price:22, dl:880,  days:12, tri:"31.5k", tex:"1K", desc:"청동 조형물. 산화된 녹색 얼룩이 텍스처에 들어 있어 야외 배치에 그대로 씁니다." },
    { id:11, m:"Chandelier_01",         t:"Chandelier 01",        by:"emberforge",  cat:"light",     eng:["unity","unreal","godot"], score:81, feel:78, price:26, dl:2010, days:4,  tri:"19.3k", tex:"1K", desc:"연회장용 대형 샹들리에. 촛대 하나하나가 분리돼 있어 일부만 켜는 연출이 됩니다." },
    { id:12, m:"gothic_coffee_table",   t:"Gothic Table",         by:"oakmoor",     cat:"furniture", eng:["unity"],                 score:80, feel:77, price:15, dl:2380, days:8,  tri:"6.9k",  tex:"1K", desc:"조각 다리가 있는 낮은 탁자. 상판이 평평해 소품을 올려 놓기 좋습니다." },
    { id:13, m:"barrel_03",             t:"Barrel 03",            by:"coopers",     cat:"prop",      eng:["unity","unreal","godot"], score:78, feel:76, price:7,  dl:9120, days:3,  tri:"2.8k",  tex:"1K", desc:"쇠테를 두른 나무통. 폴리곤이 가벼워 창고나 부두에 수십 개를 깔아도 부담이 없습니다." },
    { id:14, m:"WoodenTable_02",        t:"Wooden Table",         by:"oakmoor",     cat:"furniture", eng:["unity","godot"],         score:77, feel:75, price:11, dl:5580, days:6,  tri:"3.4k",  tex:"1K", desc:"선술집용 나무 탁자. 상판 나뭇결이 이어져 있어 여러 개를 붙여도 반복이 티나지 않습니다." },
    { id:15, m:"metal_jug",             t:"Metal Jug",            by:"tinsmith",    cat:"prop",      eng:["godot"],                 score:76, feel:74, price:6,  dl:4230, days:10, tri:"4.1k",  tex:"1K", desc:"찌그러진 금속 주전자. 눌린 자국이 메시에 들어 있어 노멀맵만으로 만든 것과 다릅니다." },
    { id:16, m:"WoodenChair_01",        t:"Wooden Chair",         by:"oakmoor",     cat:"furniture", eng:["unity","unreal"],        score:75, feel:73, price:8,  dl:6310, days:5,  tri:"2.6k",  tex:"1K", desc:"등받이 있는 나무 의자. 탁자와 같은 재질 세트라 나란히 놓으면 톤이 맞습니다." },
    { id:17, m:"ceramic_pot",           t:"Ceramic Pot",          by:"tinsmith",    cat:"prop",      eng:["unity"],                 score:74, feel:72, price:5,  dl:7840, days:2,  tri:"1.9k",  tex:"1K", desc:"유약을 바른 항아리. 표면 반사가 강해 실내 조명 확인용으로도 씁니다." },
    { id:18, m:"jug_01",                t:"Jug 01",               by:"tinsmith",    cat:"prop",      eng:["godot"],                 score:72, feel:70, price:4,  dl:3120, days:14, tri:"2.2k",  tex:"1K", desc:"손잡이 달린 도기 주전자. 깨진 변형이 없는 온전한 형태 하나입니다." },
    { id:19, m:"coast_rocks_01",        t:"Coast Rocks",          by:"stonewright", cat:"env",       eng:["unity","unreal","godot"], score:70, feel:68, price:0,  dl:12400,days:1,  tri:"8.7k",  tex:"1K", desc:"해안 바위 덩어리. 무료로 풀어 둔 것이라 지형 채우기에 부담 없이 씁니다." },
    { id:20, m:"brass_pot_01",          t:"Brass Pot",            by:"tinsmith",    cat:"prop",      eng:["unity"],                 score:66, feel:64, price:3,  dl:2740, days:18, tri:"3.8k",  tex:"1K", desc:"작은 황동 냄비. 폴리곤 대비 텍스처 해상도가 높아 가까이서만 씁니다." },
    { id:21, img:"iso/house3",   t:"Isometric House Set",  by:"indiesquid", cat:"env", eng:["unity","godot"],          score:89, feel:92, price:14, dl:5120, days:3,  tri:"—", tex:"32×48", desc:"쿼터뷰 마을 건물 타일. 지붕·벽이 한 장에 들어 있어 그대로 놓으면 격자에 맞습니다." },
    { id:22, img:"iso/trees7",   t:"Isometric Tree Pack",  by:"indiesquid", cat:"env", eng:["unity","godot"],          score:86, feel:88, price:14, dl:3940, days:5,  tri:"—", tex:"32×48", desc:"쿼터뷰 나무 타일. 여러 종을 섞어 심으면 같은 타일을 반복한 티가 나지 않습니다." },
    { id:23, img:"iso/road_nsew",t:"Isometric Road Tiles", by:"indiesquid", cat:"env", eng:["godot"],                  score:84, feel:87, price:11, dl:4680, days:2,  tri:"—", tex:"32×32", desc:"사거리·직선·곡선이 한 세트인 길 타일. 이음매가 맞아떨어집니다." },
    { id:24, img:"iso/bridge_ew",t:"Isometric Bridge",     by:"indiesquid", cat:"env", eng:["unity","godot"],          score:82, feel:85, price:11, dl:3210, days:8,  tri:"—", tex:"32×32", desc:"물 위를 건너는 다리 타일. 양끝이 지면 타일과 그대로 붙습니다." },
    { id:25, img:"L05",       t:"Ruin Layer Set",      by:"utumno",  cat:"env",  eng:["unity","unreal","godot"], score:80, feel:79, price:19, dl:2870, days:6,  tri:"—", tex:"512²", desc:"폐허 배경 레이어. 앞뒤로 겹쳐 깔면 쿼터뷰 화면에 깊이가 생깁니다." },
    { id:26, img:"L19",       t:"Crypt Layer Set",     by:"utumno",  cat:"env",  eng:["unity","godot"],          score:78, feel:77, price:19, dl:2140, days:9,  tri:"—", tex:"512²", desc:"지하 납골당 배경 레이어. 벽·바닥·기둥이 분리돼 있어 방 크기를 자유롭게 잡습니다." },
    { id:27, img:"mt-tile04", t:"Dungeon Wall Tiles",  by:"utumno",  cat:"env",  eng:["unity","godot"],          score:76, feel:75, price:8,  dl:6420, days:4,  tri:"—", tex:"64²",  desc:"이어 붙이는 벽 타일. 모서리와 이음매가 포함돼 있어 반복 배치에서 티가 나지 않습니다." },
    { id:28, img:"iso/example",  t:"Isometric Sample Map", by:"indiesquid", cat:"env", eng:["unity","unreal","godot"], score:74, feel:73, price:6,  dl:8930, days:1,  tri:"—", tex:"32²",  desc:"위 타일들로 실제 조립한 예시 맵. 어떻게 이어 붙이는지 한눈에 보입니다." },
];
