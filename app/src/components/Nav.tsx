import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";
import { logOut, useAccount } from "../lib/account";
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT, remember, switchTo, t, useLocale } from "../lib/locale";

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

/* 언어 선택. 테마 옆에 둔다.

   두 개뿐이라 드롭다운을 안 쓴다. 눌러야 목록이 열리고 거기서 또 골라야
   하면, 두 개짜리에 두 번 누르는 셈이다.

   `<a>` 다. 언어가 라우터 basename 에 들어 있어서 그 자리에서 갈아 끼울 수가
   없고 — SPA 안에서 바꾸면 이미 그려진 화면의 언어와 라우터가 어긋난다 —
   주소를 새로 열어야 한다. 그래서 `<Link>` 가 아니라 진짜 링크다.

   가는 주소는 지금 보던 자리 그대로다. 홈으로 돌려보내면 열 쪽 넘겨 찾아온
   자리를 잃는다. */
function LocalePicker() {
  const now = useLocale();
  return (
    <span className="flex items-center rounded bg-chrome-800">
      {LOCALES.map((code) => {
        const on = code === now;
        return (
          <a
            key={code}
            href={switchTo(code)}
            onClick={() => remember(code)}
            hrefLang={code}
            aria-current={on ? "true" : undefined}
            title={LOCALE_LABEL[code]}
            className={[
              "rounded px-2.5 py-1 text-[length:var(--text-nav)] no-underline",
              on
                ? "bg-chrome-700 font-bold text-white"
                : "text-gray-350 hover:bg-chrome-700 hover:text-white",
            ].join(" ")}
          >
            {LOCALE_SHORT[code]}
          </a>
        );
      })}
    </span>
  );
}

/* 계정 단추.

   상태 셋을 구분한다. 아직 안 물어본 동안 "로그인" 을 띄우면 새로고침마다
   그게 깜빡였다가 이름으로 바뀐다 — 로그인이 풀린 것처럼 보인다. */
function AccountButton() {
  const auth = useAccount();

  if (auth.status === "loading") {
    // 자리만 잡는다. 폭이 바뀌면 옆 단추들이 밀린다.
    return <span className="px-3 py-1 text-[length:var(--text-nav)] text-chrome-600">…</span>;
  }

  if (auth.status === "anon") {
    return (
      <span className="flex items-center gap-1.5">
        <Link
          to="/join?mode=login"
          className="rounded bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-gray-350 no-underline hover:bg-chrome-700 hover:text-white"
        >
          {t("로그인")}
        </Link>
        <Link
          to="/join"
          className="rounded bg-accent px-3 py-1 text-[length:var(--text-nav)] font-bold text-ground no-underline hover:bg-accent-strong"
        >
          {t("가입")}
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
        className="rounded bg-accent px-3 py-1 text-[length:var(--text-nav)] font-bold text-ground no-underline hover:bg-accent-strong"
      >
        {t("내 라이브러리")}
      </Link>
      <Link
        to="/settings"
        className="rounded bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-white no-underline hover:bg-chrome-700"
      >
        {auth.account.display_name}
      </Link>
      <button
        type="button"
        onClick={() => void logOut()}
        className="cursor-pointer rounded border-0 bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-gray-350 hover:bg-chrome-700 hover:text-white"
      >
        {t("나가기")}
      </button>
    </span>
  );
}

export function Nav() {
  const { count } = useCart();
  const { toggle } = useTheme();

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
            <Link to="/cart" className="rounded bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-gray-350 no-underline hover:bg-chrome-700 hover:text-white">
              {t("장바구니")} <b className="ml-0.5 font-extrabold text-accent">{count}</b>
            </Link>
            <AccountButton />
            <button type="button" onClick={toggle} className="cursor-pointer rounded border-0 bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-gray-350 hover:bg-chrome-700 hover:text-white">
              {t("테마")}
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
