import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";
import { logOut, useAccount } from "../lib/account";
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT, remember, switchTo, t, useLocale } from "../lib/locale";

/* 상단 우측 아이콘. 구글 머티리얼 심볼 경로를 그대로 넣는다 — 폰트/CDN 없이
   자족적으로 그린다. 채우기형(fill=currentColor)이라 색은 글자색을 따른다. */
const MI: Record<string, string> = {
  cart: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.44C4.52 12.37 5.48 14 7 14h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A.996.996 0 0 0 20 1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
  login: "M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z",
  person_add: "M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  library:
    "M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z",
  dark: "M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 0 1-4.4 2.26 5.4 5.4 0 0 1-5.4-5.4c0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z",
  light:
    "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 1 0-1.41 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 1 0-1.41 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z",
  chevron: "M7 10l5 5 5-5z",
};

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: keyof typeof MI | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={MI[name]} />
    </svg>
  );
}

/** 언어별 국기 이모지. */
const FLAG: Record<string, string> = { ko: "🇰🇷", en: "🇺🇸" };

/* 대분류는 다섯이다. 서브가 있는 것만 드롭다운을 연다. */
type Group = { label: string; to: string; badge?: string; subs?: { label: string; to: string; badge?: string }[] };

const GROUPS: Group[] = [
  { label: "홈", to: "/" },
  { label: "IR", to: "/ir" },
  { label: "마켓", to: "/market" },
  {
    label: "스튜디오",
    to: "/workshop",
    badge: "N",
    subs: [
      { label: "AI 에디터", to: "/workshop", badge: "N" },
      { label: "AI 에셋", to: "/scene" },
      { label: "AI 뷰어", to: "/viewer" },
    ],
  },
  {
    label: "커뮤니티",
    to: "/news",
    subs: [
      { label: "뉴스", to: "/news" },
      { label: "사례", to: "/feed" },
      { label: "기사", to: "/articles" },
    ],
  },
];

/* 대분류 하나. 눌러서 열고, 밖을 누르거나 Esc 로 닫는다.
   호버로도 열리지만 그건 보조다 — 터치에는 호버가 없다. */
function Group({ group }: { group: Group }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  /* 오른쪽 끝 탭에서 열면 메뉴가 화면 밖으로 나간다. 열릴 때 안쪽으로 민다. */
  const [shift, setShift] = useState(0);
  const inside = group.subs!.some((s) => s.to === pathname) || group.to === pathname;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const over = el.getBoundingClientRect().right - (document.documentElement.clientWidth - 12);
    setShift(over > 0 ? -over : 0);
  }, [open]);

  /* 다른 화면으로 넘어가면 닫는다. 열린 채 남으면 본문을 가린다. */
  useEffect(() => setOpen(false), [pathname]);

  return (
    <span ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          "flex cursor-pointer items-center gap-1 rounded border-0 bg-transparent px-2.5 py-1 whitespace-nowrap text-[length:var(--text-navsub)]",
          inside
            ? "rounded-b-none font-bold text-white shadow-[inset_0_-2px_0_var(--accent)]"
            : "text-chrome-300 hover:bg-white/7 hover:text-white",
        ].join(" ")}
      >
        {t(group.label)}
        {group.badge && <sup className="text-[6pt] font-extrabold text-[#FF6B7A]">{group.badge}</sup>}
        <span className={`ml-0.5 text-[6pt] opacity-55 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* 닫혔을 때는 아예 그리지 않는다. 안 보이는 메뉴도 폭을 차지해서
          오른쪽 탭의 메뉴가 화면 밖으로 스크롤을 만든다. */}
      {open && (
        <span
          ref={menuRef}
          role="menu"
          style={{ marginLeft: shift }}
          className="absolute top-[calc(100%+4px)] left-0 z-[9600] flex min-w-[168px] max-w-[calc(100vw-1.5rem)] animate-[drop_.14s_ease-out] flex-col gap-px rounded-md border border-chrome-800 bg-chrome-900 p-1 shadow-[0_12px_28px_rgb(0_0_0/0.34)]"
        >
          {group.subs!.map((s) => (
            <NavLink key={s.to + s.label} to={s.to} className={tabClass} role="menuitem">
              {t(s.label)}
              {s.badge && <sup className="text-[6pt] font-extrabold text-[#FF6B7A]">{s.badge}</sup>}
            </NavLink>
          ))}
          <style>{`@keyframes drop { from { opacity: 0; translate: 0 -4px } }`}</style>
        </span>
      )}
    </span>
  );
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-1 rounded px-2.5 py-1 whitespace-nowrap text-[length:var(--text-navsub)] no-underline",
    isActive
      ? "rounded-b-none font-bold text-white shadow-[inset_0_-2px_0_var(--accent)]"
      : "text-chrome-300 hover:bg-white/7 hover:text-white",
  ].join(" ");

/* 언어 선택 — 국기와 코드를 단 드롭다운.

   항목은 진짜 링크(`<a href>`)다. 언어가 라우터 basename 에 들어 있어서 SPA
   안에서 갈아 끼우면 화면과 라우터가 어긋난다 — 주소를 새로 열어야 한다.
   가는 곳은 지금 보던 자리 그대로다. */
function LocalePicker() {
  const now = useLocale();
  return (
    <details className="relative">
      <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2 text-[length:var(--text-nav)] text-gray-350 backdrop-blur-md hover:bg-white/[0.12] hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="text-[13px] leading-none">{FLAG[now]}</span>
        <b className="font-bold">{LOCALE_SHORT[now]}</b>
        <Icon name="chevron" className="h-3 w-3" />
      </summary>
      {/* 언어는 라우터 basename 에 있어 그 자리에서 못 바꾼다 — 진짜 링크로
         주소를 새로 연다. 고르면 페이지가 다시 떠서 이 드롭다운은 닫힌다. */}
      <div className="absolute right-0 z-[9100] mt-1 min-w-[104px] overflow-hidden rounded-md border border-chrome-800 bg-chrome-850 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
        {LOCALES.map((code) => {
          const on = code === now;
          return (
            <a
              key={code}
              href={switchTo(code)}
              onClick={() => remember(code)}
              hrefLang={code}
              aria-current={on ? "true" : undefined}
              className={[
                "flex items-center gap-2 px-3 py-1.5 text-[length:var(--text-nav)] no-underline",
                on ? "bg-chrome-800 font-bold text-white" : "text-gray-350 hover:bg-chrome-800 hover:text-white",
              ].join(" ")}
            >
              <span className="text-[13px] leading-none">{FLAG[code]}</span>
              {LOCALE_LABEL[code]}
            </a>
          );
        })}
      </div>
    </details>
  );
}

/* 계정 단추.

   상태 셋을 구분한다. 아직 안 물어본 동안 "로그인" 을 띄우면 새로고침마다
   그게 깜빡였다가 이름으로 바뀐다 — 로그인이 풀린 것처럼 보인다. */
function AccountButton() {
  const auth = useAccount();

  if (auth.status === "loading") {
    // 자리만 잡는다. 폭이 바뀌면 옆 단추들이 밀린다.
    return <span className="h-6 w-6" />;
  }

  if (auth.status === "anon") {
    return (
      <span className="flex items-center gap-1.5">
        <Link
          to="/join?mode=login"
          aria-label={t("로그인")}
          title={t("로그인")}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-chrome-800 text-gray-350 no-underline hover:bg-chrome-700 hover:text-white"
        >
          <Icon name="login" className="h-[15px] w-[15px]" />
        </Link>
        <Link
          to="/join"
          aria-label={t("가입")}
          title={t("가입")}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-ground no-underline hover:bg-accent-strong"
        >
          <Icon name="person_add" className="h-[15px] w-[15px]" />
        </Link>
      </span>
    );
  }

  /* 로그인하면 라이브러리가 먼저다.

     업로드를 최상단에 단독으로 두면 로그인 안 한 사람에게도 보이고, 눌러 봐야
     로그인 화면으로 튕긴다. 산 것·올린 것·만든 것이 한자리에 모이는 곳을
     열고, 올리기는 그 안에 둔다. */
  return (
    <span className="flex items-center gap-1.5">
      <Link
        to="/library"
        aria-label={t("내 라이브러리")}
        title={t("내 라이브러리")}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-ground no-underline hover:bg-accent-strong"
      >
        <Icon name="library" className="h-[15px] w-[15px]" />
      </Link>
      <Link
        to="/settings"
        aria-label={auth.account.display_name}
        title={auth.account.display_name}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-chrome-800 text-white no-underline hover:bg-chrome-700"
      >
        <Icon name="person" className="h-[15px] w-[15px]" />
      </Link>
      <button
        type="button"
        onClick={() => void logOut()}
        aria-label={t("나가기")}
        title={t("나가기")}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-0 border border-white/10 bg-white/[0.06] text-gray-350 backdrop-blur-md hover:bg-white/[0.12] hover:text-white"
      >
        <Icon name="logout" className="h-[15px] w-[15px]" />
      </button>
    </span>
  );
}

export function Nav() {
  const { count } = useCart();
  const { theme, toggle } = useTheme();

  return (
    <nav className="sticky top-0 z-[9000] font-sans">
      {/* 1행 — 브랜드와 계정 */}
      <div className="border-b border-chrome-800 bg-chrome-900">
        <div className="mx-auto flex min-h-[38px] max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-1.5">
          <Link to="/" className="flex flex-none items-center gap-2 text-[11pt] font-black tracking-[-0.03em] text-white no-underline">
            <b className="font-black">LaughGG</b>
            <span className="self-end pb-0.5 text-[4pt] font-bold tracking-[0.14em] text-chrome-600 uppercase">
              Agent by OP.GG
            </span>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Link
              to="/cart"
              aria-label={t("장바구니")}
              title={t("장바구니")}
              className="relative flex h-6 w-6 items-center justify-center rounded-md bg-chrome-800 text-gray-350 no-underline hover:bg-chrome-700 hover:text-white"
            >
              <Icon name="cart" className="h-[15px] w-[15px]" />
              {count > 0 && (
                <b className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF6B7A] px-1 text-[9px] font-extrabold text-white">
                  {count}
                </b>
              )}
            </Link>
            <AccountButton />
            <button
              type="button"
              onClick={toggle}
              aria-label={t("테마")}
              title={t("테마")}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-0 border border-white/10 bg-white/[0.06] text-gray-350 backdrop-blur-md hover:bg-white/[0.12] hover:text-white"
            >
              <Icon name={theme === "dark" ? "light" : "dark"} className="h-[15px] w-[15px]" />
            </button>
            <LocalePicker />
          </div>
        </div>
      </div>

      {/* 2행 — 대분류. 스크롤 컨테이너로 두면 드롭다운이 잘리므로 줄바꿈으로 흘린다. */}
      <div className="bg-chrome-850">
        <div className="mx-auto flex min-h-[36px] max-w-[1240px] items-center gap-3.5 px-5 py-1.5">
          <div className="flex flex-wrap gap-0.5">
            {GROUPS.map((g) => (g.subs ? <Group key={g.to} group={g} /> : (
              <NavLink key={g.to} to={g.to} className={tabClass} end={g.to === "/"}>
                {t(g.label)}
              </NavLink>
            )))}
          </div>
        </div>
      </div>
    </nav>
  );
}
