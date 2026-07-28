/* 마켓 상품 — 전부 CC0 다. 출처는 저장소 루트 CREDITS.md 에 있다.
   m 은 Poly Haven glTF 모델 이름, img 는 도트 스프라이트 파일 이름이다. */
export type Piece = {
  id: number;
  /** Poly Haven glTF 모델. 도트 상품에는 없다. */
  m?: string;
  /** 외부 CC0 단일 glb 경로(assets/ 아래). Poly Haven 이 아닌 캐릭터·레벨용. */
  glb?: string;
  /** 소리 상품의 오디오 경로(assets/ 아래). 있으면 그림 대신 파형+재생으로 낸다. */
  audio?: string;
  /** VFX 상품의 이펙트 스프라이트 경로(assets/ 아래). 도트가 아니라 부드럽게,
      은은한 글로우와 맥동으로 낸다. */
  fx?: string;
  /** 도트 스프라이트. 3D 상품에는 없다. */
  img?: string;
  /** 올린 파일의 objectURL. 있으면 m/img 대신 이걸 쓴다. */
  url?: string;
  /** 올린 파일이 모델인지 그림인지. 마켓 상품에는 없다. */
  kind?: "model" | "image";
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
  /** 캐릭터 전용. 포함 애니메이션 이름. 캐릭터는 그림보다 모션이 make-or-break라
      상세에서 이걸 제일 먼저 보여 준다. 없으면 정적 에셋으로 표시한다. */
  anim?: string[];
  desc: string;
};

export const CATS = [
  ["all", "전체"],
  ["env", "환경/구조물"],
  ["weapon", "무기/방어구"],
  ["char", "캐릭터/도트"],
  ["prop", "소품"],
  ["light", "조명"],
  ["furniture", "가구"],
  ["tex", "재질"],
  ["sfx", "이펙트/사운드"],
  ["vfx", "VFX/파티클"],
  ["music", "음악/BGM"],
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
  { k: "에셋 무결성", d: "토폴로지, UV, LOD" },
  { k: "런타임 성능", d: "실측 프레임 영향" },
  { k: "라이선스 출처", d: "학습 소스 추적" },
  { k: "코드 품질", d: "결합도와 테스트" },
  { k: "통합 난이도", d: "붙이는 데 걸리는 시간" },
  { k: "게임 필", d: "입력 반응과 연출 타이밍" },
] as const;

/** 3D 로 열 수 있는가. 올린 파일이면 확장자가, 마켓 상품이면 m 이 결정한다. */
export function isModel(p: Piece): boolean {
  return p.url ? p.kind === "model" : Boolean(p.m || p.glb);
}

/** three 에 넘길 glTF 주소. 3D 가 아니면 null 이다. */
export function modelSrc(p: Piece): string | null {
  if (p.url) return p.kind === "model" ? p.url : null;
  if (p.glb) return `${import.meta.env.BASE_URL}assets/${p.glb}`;
  return p.m ? `${import.meta.env.BASE_URL}assets/ph/${p.m}/${p.m}_1k.gltf` : null;
}

/** 2D 로 쓸 그림 주소. 3D 상품은 구워야 하므로 null 이다. */
export function imageSrc(p: Piece): string | null {
  if (p.url) return p.kind === "image" ? p.url : null;
  return p.img ? `${import.meta.env.BASE_URL}assets/${p.img}.png` : null;
}

export const PIECES: Piece[] = [
    { id:1,  m:"gothic_statue",         t:"Gothic Statue",        by:"stonewright", cat:"env",       eng:["unity","unreal"],        score:94, feel:91, price:38, dl:2140, days:2,  tri:"18.4k", tex:"1K", desc:"성당 정면에 놓는 석상. 노멀맵으로 조각 디테일을 담아 폴리곤을 아꼈고, 정면,측면 실루엣이 모두 살아 있습니다." },
    { id:2,  m:"kite_shield",           t:"Kite Shield",          by:"ironbark",    cat:"weapon",    eng:["unity","unreal","godot"], score:92, feel:89, price:24, dl:3820, days:4,  tri:"4.2k",  tex:"1K", desc:"가죽 띠와 금속 보스가 분리된 머티리얼로 들어갑니다. 손에 쥐는 각도에서 두께가 자연스럽게 보이도록 옆면을 살렸습니다." },
    { id:3,  m:"lantern_chandelier_01", t:"Lantern Chandelier",   by:"emberforge",  cat:"light",     eng:["unity","unreal"],        score:91, feel:88, price:32, dl:1680, days:1,  tri:"22.1k", tex:"1K", desc:"천장에 매다는 랜턴형 샹들리에. 유리 부분이 별도 머티리얼이라 안쪽 광원을 그대로 통과시킵니다." },
    { id:4,  m:"brass_candleholders",   t:"Brass Candleholders",  by:"emberforge",  cat:"light",     eng:["unity"],                 score:90, feel:87, price:18, dl:2960, days:3,  tri:"9.8k",  tex:"1K", desc:"5구 황동 촛대. 금속 러프니스가 부위별로 달라 촛농 자국이 남은 아랫부분이 무광으로 보입니다." },
    { id:5,  m:"cross_pein_hammer",     t:"Cross Pein Hammer",    by:"ironbark",    cat:"weapon",    eng:["unreal","godot"],        score:88, feel:86, price:12, dl:4410, days:6,  tri:"3.1k",  tex:"1K", desc:"대장간 소품이자 근접 무기로 쓸 수 있는 망치. 나무 자루의 결과 쇠머리의 마모가 텍스처에 들어 있습니다." },
    { id:6,  m:"Lantern_01",            t:"Lantern 01",           by:"emberforge",  cat:"light",     eng:["unity","unreal"],        score:87, feel:85, price:16, dl:5230, days:2,  tri:"7.4k",  tex:"1K", desc:"손에 드는 등불. 유리,황동,심지가 각각 머티리얼로 나뉘어 있어 불빛만 따로 제어할 수 있습니다." },
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
    { id:21, img:"iso/house3",   t:"Isometric House Set",  by:"indiesquid", cat:"env", eng:["unity","godot"],          score:89, feel:92, price:14, dl:5120, days:3,  tri:"—", tex:"32×48", desc:"쿼터뷰 마을 건물 타일. 지붕,벽이 한 장에 들어 있어 그대로 놓으면 격자에 맞습니다." },
    { id:22, img:"iso/trees7",   t:"Isometric Tree Pack",  by:"indiesquid", cat:"env", eng:["unity","godot"],          score:86, feel:88, price:14, dl:3940, days:5,  tri:"—", tex:"32×48", desc:"쿼터뷰 나무 타일. 여러 종을 섞어 심으면 같은 타일을 반복한 티가 나지 않습니다." },
    { id:23, img:"iso/road_nsew",t:"Isometric Road Tiles", by:"indiesquid", cat:"env", eng:["godot"],                  score:84, feel:87, price:11, dl:4680, days:2,  tri:"—", tex:"32×32", desc:"사거리,직선,곡선이 한 세트인 길 타일. 이음매가 맞아떨어집니다." },
    { id:24, img:"iso/bridge_ew",t:"Isometric Bridge",     by:"indiesquid", cat:"env", eng:["unity","godot"],          score:82, feel:85, price:11, dl:3210, days:8,  tri:"—", tex:"32×32", desc:"물 위를 건너는 다리 타일. 양끝이 지면 타일과 그대로 붙습니다." },
    { id:25, img:"L05",       t:"Ruin Layer Set",      by:"utumno",  cat:"env",  eng:["unity","unreal","godot"], score:80, feel:79, price:19, dl:2870, days:6,  tri:"—", tex:"512²", desc:"폐허 배경 레이어. 앞뒤로 겹쳐 깔면 쿼터뷰 화면에 깊이가 생깁니다." },
    { id:26, img:"L19",       t:"Crypt Layer Set",     by:"utumno",  cat:"env",  eng:["unity","godot"],          score:78, feel:77, price:19, dl:2140, days:9,  tri:"—", tex:"512²", desc:"지하 납골당 배경 레이어. 벽,바닥,기둥이 분리돼 있어 방 크기를 자유롭게 잡습니다." },
    { id:27, img:"mt-tile04", t:"Dungeon Wall Tiles",  by:"utumno",  cat:"env",  eng:["unity","godot"],          score:76, feel:75, price:8,  dl:6420, days:4,  tri:"—", tex:"64²",  desc:"이어 붙이는 벽 타일. 모서리와 이음매가 포함돼 있어 반복 배치에서 티가 나지 않습니다." },
    { id:28, img:"iso/example",  t:"Isometric Sample Map", by:"indiesquid", cat:"env", eng:["unity","unreal","godot"], score:74, feel:73, price:6,  dl:8930, days:1,  tri:"—", tex:"32²",  desc:"위 타일들로 실제 조립한 예시 맵. 어떻게 이어 붙이는지 한눈에 보입니다." },

    // 캐릭터 — 애니메이션 포함 glb. 캐릭터는 모션이 make-or-break라 실제 클립
    // 이름을 그대로 anim 에 노출한다(glb 에서 직접 읽음). 전부 CC0/공개.
    { id:29, glb:"char/RobotExpressive.glb", t:"Expressive Robot", by:"donmccurdy", cat:"char", eng:["unity","unreal","godot"], score:90, feel:93, price:29, dl:3120, days:2, tri:"6.9k", tex:"1K",
      anim:["Idle","Walking","Running","Jump","Punch","Wave","Dance","Sitting","Standing","Death","Yes","No","ThumbsUp","WalkJump"],
      desc:"리깅과 애니메이션 14종이 함께 들어오는 로봇 캐릭터. 컨트롤러에 그대로 물려 걷기, 달리기, 점프, 펀치까지 바로 씁니다." },
    { id:30, glb:"char/Fox.glb", t:"Low Poly Fox", by:"pixelmannen", cat:"char", eng:["unity","unreal","godot"], score:85, feel:88, price:18, dl:5400, days:3, tri:"1.7k", tex:"512²",
      anim:["Survey","Walk","Run"],
      desc:"저폴리 여우 크리처. 둘러보기, 걷기, 달리기 3종 애니메이션이 포함돼 소환수나 야생 동물로 바로 씁니다." },

    // 맵/레벨 — 조립된 3D 레벨. 정적 메시라 베이커로 그대로 구워 미리보기가 된다.
    { id:31, glb:"map/TempleFloor01_Art.glb", t:"Tomb Temple Map",   by:"polygonalmind", cat:"env", eng:["unity","unreal","godot"], score:84, feel:86, price:22, dl:2680, days:4, tri:"14k", tex:"1K",
      desc:"이집트 무덤 신전 바닥 레벨. 계단과 단이 한 메시라 그대로 깔면 던전 한 방이 됩니다." },
    { id:32, glb:"map/TempleFloor03_Art.glb", t:"Sunken Temple Map", by:"polygonalmind", cat:"env", eng:["unity","unreal","godot"], score:82, feel:84, price:22, dl:1940, days:7, tri:"13k", tex:"1K",
      desc:"가라앉은 신전 바닥 레벨. 무덤 화풍 무대에 그대로 올리는 배경 맵으로 씁니다." },
    { id:33, glb:"map/Layout_Floor01.glb", t:"Dungeon Layout Block", by:"polygonalmind", cat:"env", eng:["unity","godot"], score:80, feel:82, price:26, dl:1510, days:9, tri:"31k", tex:"1K",
      desc:"조합형 던전 레이아웃 블록. 여러 개를 이어 붙여 층을 만들고 트랩과 소품을 얹습니다." },

    // 이펙트/사운드 — 그림이 없어 파형+재생 버튼으로 낸다. 오디오는 어느 게임에나
    // 돌려 쓰기 좋아 재사용 난도가 낮다. 전부 Kenney CC0.
    { id:34, audio:"sfx/confirmation_001.wav", t:"UI Confirm FX", by:"kenney", cat:"sfx", eng:["unity","unreal","godot"], score:88, feel:90, price:4, dl:12100, days:2, tri:"—", tex:"WAV",
      desc:"확인·완료 UI 효과음. 버튼과 팝업 마무리에 얹어 손맛을 줍니다." },
    { id:35, audio:"sfx/error_002.wav", t:"Error Alert FX", by:"kenney", cat:"sfx", eng:["unity","unreal","godot"], score:86, feel:88, price:4, dl:9800, days:3, tri:"—", tex:"WAV",
      desc:"오류·경고 효과음. 잘못된 입력이나 실패 피드백에 씁니다." },
    { id:36, audio:"sfx/glass_003.wav", t:"Glass Break FX", by:"kenney", cat:"sfx", eng:["unity","unreal","godot"], score:85, feel:87, price:4, dl:7600, days:5, tri:"—", tex:"WAV",
      desc:"유리 깨짐 효과음. 파괴와 타격 연출에 얹습니다." },
    { id:37, audio:"sfx/drop_003.wav", t:"Item Drop FX", by:"kenney", cat:"sfx", eng:["unity","unreal","godot"], score:84, feel:86, price:4, dl:8300, days:4, tri:"—", tex:"WAV",
      desc:"아이템 드롭·획득 효과음. 인벤토리 연출에 씁니다." },
    { id:38, audio:"sfx/maximize_003.wav", t:"Whoosh UI FX", by:"kenney", cat:"sfx", eng:["unity","unreal","godot"], score:82, feel:85, price:4, dl:6100, days:6, tri:"—", tex:"WAV",
      desc:"휙 열림 효과음. 창과 메뉴 전환에 씁니다." },
    { id:39, audio:"sfx/bong_001.wav", t:"Notify Bell FX", by:"kenney", cat:"sfx", eng:["unity","unreal","godot"], score:81, feel:84, price:4, dl:5400, days:8, tri:"—", tex:"WAV",
      desc:"알림 벨 효과음. 완료와 수신 알림에 씁니다." },

    // VFX/파티클 — 스킬·마법 이펙트. 스프라이트라 파티클 텍스처로 그대로 쓰거나
    // 파티클 시스템의 입자로 물린다. 파티클은 재사용 난도 낮음(안전군). Kenney CC0.
    { id:40, fx:"vfx/magic_03.png", t:"Magic Circle VFX",  by:"kenney", cat:"vfx", eng:["unity","unreal","godot"], score:89, feel:92, price:5, dl:9400, days:2, tri:"—", tex:"PNG",
      desc:"마법진·소환 스킬 이펙트. 시전 연출과 광역 표식에 씁니다." },
    { id:41, fx:"vfx/slash_02.png", t:"Slash Hit VFX",     by:"kenney", cat:"vfx", eng:["unity","unreal","godot"], score:87, feel:90, price:5, dl:8100, days:3, tri:"—", tex:"PNG",
      desc:"베기·근접 타격 이펙트. 검격과 참격 순간에 얹습니다." },
    { id:42, fx:"vfx/spark_05.png", t:"Lightning VFX",     by:"kenney", cat:"vfx", eng:["unity","unreal","godot"], score:86, feel:89, price:5, dl:7300, days:4, tri:"—", tex:"PNG",
      desc:"전격·번개 스킬 이펙트. 감전과 체인 라이트닝에 씁니다." },
    { id:43, fx:"vfx/muzzle_04.png", t:"Flame Burst VFX",  by:"kenney", cat:"vfx", eng:["unity","unreal","godot"], score:85, feel:88, price:5, dl:6600, days:5, tri:"—", tex:"PNG",
      desc:"화염 분출·머즐 플래시 이펙트. 발사와 화염 스킬에 씁니다." },
    { id:44, fx:"vfx/star_08.png", t:"Sparkle Burst VFX",  by:"kenney", cat:"vfx", eng:["unity","unreal","godot"], score:83, feel:86, price:5, dl:5900, days:6, tri:"—", tex:"PNG",
      desc:"반짝임·획득 이펙트. 아이템 습득과 버프 연출에 씁니다." },
    { id:45, fx:"vfx/twirl_02.png", t:"Swirl VFX",         by:"kenney", cat:"vfx", eng:["unity","unreal","godot"], score:82, feel:85, price:5, dl:5100, days:8, tri:"—", tex:"PNG",
      desc:"소용돌이·회오리 이펙트. 회전 스킬과 포탈 연출에 씁니다." },

    // 음악/BGM — 소리라 파형+재생 카드로 낸다. 오디오는 그냥 사서 어디에나 돌려
    // 쓰는 안전군. 전부 Kenney CC0 징글.
    { id:46, audio:"music/nes.ogg", t:"8-Bit Jingle",      by:"kenney", cat:"music", eng:["unity","unreal","godot"], score:87, feel:90, price:4, dl:8800, days:3, tri:"—", tex:"OGG",
      desc:"8비트 NES풍 짧은 징글. 레트로 게임 승리와 화면 전환에 씁니다." },
    { id:47, audio:"music/pizzi.ogg", t:"Pizzicato Jingle", by:"kenney", cat:"music", eng:["unity","unreal","godot"], score:85, feel:88, price:4, dl:6400, days:4, tri:"—", tex:"OGG",
      desc:"피치카토 현악 징글. 아기자기한 퍼즐과 캐주얼 게임 분위기에 씁니다." },
    { id:48, audio:"music/sax.ogg", t:"Sax Jingle",         by:"kenney", cat:"music", eng:["unity","unreal","godot"], score:84, feel:87, price:4, dl:5200, days:5, tri:"—", tex:"OGG",
      desc:"색소폰 징글. 느긋한 재즈풍 메뉴와 로비 배경에 씁니다." },
    { id:49, audio:"music/steel.ogg", t:"Steel Drum Jingle", by:"kenney", cat:"music", eng:["unity","unreal","godot"], score:83, feel:86, price:4, dl:4700, days:6, tri:"—", tex:"OGG",
      desc:"스틸 드럼 징글. 트로피컬하고 경쾌한 스테이지 연출에 씁니다." },
    { id:50, audio:"music/hit.ogg", t:"Hit Sting Jingle",   by:"kenney", cat:"music", eng:["unity","unreal","godot"], score:81, feel:85, price:4, dl:4100, days:8, tri:"—", tex:"OGG",
      desc:"타격감 있는 스팅어 징글. 보스 등장과 강조 순간에 씁니다." },
];
