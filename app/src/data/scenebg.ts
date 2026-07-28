/* 화풍(sub) → 배경 씬 슬롯.

   무대에 게임 세계처럼 보이는 배경을 깐다. 실제 게임 스크린샷은 저작권이라
   못 쓰고, 게임 하나하나가 아니라 **화풍 태그**에 배경 한 장을 매핑한다 —
   같은 화풍 게임들이 공유하고, 위에 그 게임의 색보정·팔레트가 얹혀 달라 보인다.

   지금 채운 건 코드로 생성한 SVG 씬(그라디언트+실루엣+대기광)이다. 진짜
   AI 생성 배경 PNG 를 만들면 web/assets/scenes/{slug}.png 로 떨구고 여기
   슬러그만 그쪽으로 바꾸면 그대로 붙는다. */
export const SCENE_BG: Record<string, string> = {
  "다크 판타지": "dark-fantasy",
  "하이 판타지": "high-fantasy",
  "사이버펑크": "cyberpunk",
  "포스트 아포칼립스": "post-apoc",
  "밀리터리": "military",
};
