/* 배지 엠블럼 — 방패를 공통 골격으로 두고 장식과 색으로만 등급을 가른다.
   22px 목록 배지부터 64px 배지표까지 같은 심볼 하나를 쓴다.
   문서에 한 번만 심고 어디서든 <RankIcon> 으로 참조한다. */
export function RankDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false"><defs>
  <linearGradient id="rg-chal" x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
    <stop offset="0" stopColor="#FFF3D2"/><stop offset=".34" stopColor="#F2C066"/>
    <stop offset=".68" stopColor="#C68F2E"/><stop offset="1" stopColor="#7A551A"/></linearGradient>
  <linearGradient id="rg-dia" x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
    <stop offset="0" stopColor="#F2F5FA"/><stop offset=".34" stopColor="#C3CBD8"/>
    <stop offset=".68" stopColor="#8A94A5"/><stop offset="1" stopColor="#4E5666"/></linearGradient>
  <linearGradient id="rg-plat" x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
    <stop offset="0" stopColor="#E4E9F0"/><stop offset=".34" stopColor="#AAB3C0"/>
    <stop offset=".68" stopColor="#727B88"/><stop offset="1" stopColor="#3E454F"/></linearGradient>
  <linearGradient id="rg-silv" x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
    <stop offset="0" stopColor="#D6DBE2"/><stop offset=".34" stopColor="#98A0AC"/>
    <stop offset=".68" stopColor="#646C78"/><stop offset="1" stopColor="#353B44"/></linearGradient>
  <linearGradient id="rg-sheen" x1="12" y1="6" x2="52" y2="34" gradientUnits="userSpaceOnUse">
    <stop offset="0" stopColor="#fff" stopOpacity=".55"/>
    <stop offset=".52" stopColor="#fff" stopOpacity=".08"/>
    <stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>

  <symbol id="rk-chal" viewBox="0 0 64 64">
    <path d="M11.5 21.5 1 12.4l3.9 11.4-3 1.9 9.6 4.1z" fill="url(#rg-chal)" opacity=".62"/>
    <path d="M52.5 21.5 63 12.4l-3.9 11.4 3 1.9-9.6 4.1z" fill="url(#rg-chal)" opacity=".62"/>
    <path d="M32 3 55 11.6v18.6C55 44.6 44.8 54.9 32 61 19.2 54.9 9 44.6 9 30.2V11.6z" fill="url(#rg-chal)"/>
    <path d="M32 3 55 11.6v3.1L32 6.4 9 14.7v-3.1z" fill="url(#rg-sheen)"/>
    <path d="M32 8.6 49.6 15.2v14.6c0 10.9-7.6 19-17.6 23.9-10-4.9-17.6-13-17.6-23.9V15.2z" fill="#0A0A10" opacity=".38"/>
    <path d="m21.4 36.6-3.1-12.9 8 6.1L32 20l5.7 9.8 8-6.1-3.1 12.9z" fill="url(#rg-chal)"/>
    <path d="M21.4 39.4h21.2v3.4H21.4z" fill="url(#rg-chal)"/>
    <circle cx="32" cy="31.4" r="2.5" fill="#fff" opacity=".55"/>
  </symbol>

  <symbol id="rk-dia" viewBox="0 0 64 64">
    <path d="M32 3 55 11.6v18.6C55 44.6 44.8 54.9 32 61 19.2 54.9 9 44.6 9 30.2V11.6z" fill="url(#rg-dia)"/>
    <path d="M32 3 55 11.6v3.1L32 6.4 9 14.7v-3.1z" fill="url(#rg-sheen)"/>
    <path d="M32 8.6 49.6 15.2v14.6c0 10.9-7.6 19-17.6 23.9-10-4.9-17.6-13-17.6-23.9V15.2z" fill="#0A0A10" opacity=".38"/>
    <path d="m32 19.4 11.6 9.4L32 46 20.4 28.8z" fill="url(#rg-dia)"/>
    <path d="M20.4 28.8h23.2L32 33.2z" fill="#0A0A10" opacity=".3"/>
    <path d="m32 19.4 5.2 9.4L32 33.2l-5.2-4.4z" fill="#fff" opacity=".42"/>
    <path d="M14.6 24h3.2v9h-3.2zM46.2 24h3.2v9h-3.2z" fill="url(#rg-dia)" opacity=".7"/>
  </symbol>

  <symbol id="rk-plat" viewBox="0 0 64 64">
    <path d="M32 3 55 11.6v18.6C55 44.6 44.8 54.9 32 61 19.2 54.9 9 44.6 9 30.2V11.6z" fill="url(#rg-plat)"/>
    <path d="M32 3 55 11.6v3.1L32 6.4 9 14.7v-3.1z" fill="url(#rg-sheen)"/>
    <path d="M32 8.6 49.6 15.2v14.6c0 10.9-7.6 19-17.6 23.9-10-4.9-17.6-13-17.6-23.9V15.2z" fill="#0A0A10" opacity=".38"/>
    <path d="m32 19.6 10.4 6v12l-10.4 6-10.4-6v-12z" fill="url(#rg-plat)"/>
    <path d="M21.6 25.6 32 31.6l10.4-6L32 19.6z" fill="#fff" opacity=".34"/>
    <path d="M32 31.6v12l-10.4-6v-12z" fill="#0A0A10" opacity=".22"/>
  </symbol>

  <symbol id="rk-silv" viewBox="0 0 64 64">
    <path d="M32 3 55 11.6v18.6C55 44.6 44.8 54.9 32 61 19.2 54.9 9 44.6 9 30.2V11.6z" fill="url(#rg-silv)"/>
    <path d="M32 3 55 11.6v3.1L32 6.4 9 14.7v-3.1z" fill="url(#rg-sheen)"/>
    <path d="M32 8.6 49.6 15.2v14.6c0 10.9-7.6 19-17.6 23.9-10-4.9-17.6-13-17.6-23.9V15.2z" fill="#0A0A10" opacity=".38"/>
    <path d="M22.4 26.4h19.2v5.2H22.4z" fill="url(#rg-silv)"/>
    <path d="M22.4 26.4h19.2v2.1H22.4z" fill="#fff" opacity=".36"/>
    <path d="M25.6 35.6h12.8v3.2H25.6z" fill="url(#rg-silv)" opacity=".8"/>
  </symbol>
</defs></svg>
);
}

export const BADGES = ["chal", "dia", "plat", "silv"] as const;
export type BadgeKey = (typeof BADGES)[number];

export const BADGE_LABEL: Record<BadgeKey, string> = {
  chal: "챌린저",
  dia: "다이아",
  plat: "플래티넘",
  silv: "실버",
};

/** 점수에서 배지를 정한다. 90+ 챌린저 · 80+ 다이아 · 70+ 플래티넘 · 그 아래 실버. */
export function badgeOf(score: number): BadgeKey {
  return score >= 90 ? "chal" : score >= 80 ? "dia" : score >= 70 ? "plat" : "silv";
}

export function RankIcon({ badge, size = 22, className }: {
  badge: BadgeKey;
  size?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} className={className} role="img"
         aria-label={BADGE_LABEL[badge]}>
      <use href={`#rk-${badge}`} />
    </svg>
  );
}
