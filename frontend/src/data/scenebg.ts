/* 화풍(sub) → 배경 씬 슬롯.

   무대에 게임 세계처럼 보이는 배경을 깐다. 실제 게임 스크린샷은 저작권이라
   못 쓰고, 게임 하나하나가 아니라 **화풍 태그**에 배경 한 장을 매핑한다 —
   같은 화풍 게임들이 공유하고, 위에 그 게임의 색보정·팔레트가 얹혀 달라 보인다.

   지금 채운 건 코드로 생성한 SVG 씬(그라디언트+실루엣+대기광)이다. 진짜
   AI 생성 배경 PNG 를 만들면 assets/scenes/{slug}.png 로 떨구고 여기
   슬러그만 그쪽으로 바꾸면 그대로 붙는다. */
export const SCENE_BG: Record<string, string> = {
  "다크 판타지": "dark-fantasy",
  "하이 판타지": "high-fantasy",
  "사이버펑크": "cyberpunk",
  "포스트 아포칼립스": "post-apoc",
  "밀리터리": "military",
};

/* 게임 하나에만 붙는 배경 맵(확장자 포함). 화풍 공용 배경(SCENE_BG)보다 앞선다.
   실제 CC0 무덤 에셋(Polygonal Mind tomb-chaser)을 던전 한 방으로 조립해 구운
   PNG/JPG 다. 화풍 태그로는 못 잡는 "이 게임만의 무대"를 소유자가 박제한 자리 —
   지금은 Diablo IV 한 개가 샘플이다. 값은 assets/scenes/ 아래 파일명 그대로. */
export const GAME_MAP: Record<string, string> = {
  diablo4: "tomb-dungeon.jpg",
};
