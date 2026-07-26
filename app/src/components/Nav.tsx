import { NavLink, Link, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { useTheme } from "../lib/theme";

/* 대분류는 다섯이다. 서브가 있는 것만 드롭다운을 연다. */
type Group = { label: string; to: string; badge?: string; subs?: { label: string; to: string; badge?: string }[] };

const GROUPS: Group[] = [
  { label: "홈", to: "/" },
  { label: "IR", to: "/ir" },
  { label: "마켓", to: "/market" },
  { label: "엔진", to: "/stack" },
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
      { label: "공략집", to: "/feed" },
      { label: "브이로그", to: "/vlog" },
      { label: "기사", to: "/articles" },
    ],
  },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-1 rounded px-2.5 py-1 whitespace-nowrap text-[length:var(--text-navsub)] no-underline",
    isActive
      ? "rounded-b-none font-bold text-white shadow-[inset_0_-2px_0_var(--accent)]"
      : "text-chrome-300 hover:bg-white/7 hover:text-white",
  ].join(" ");

export function Nav() {
  const { pathname } = useLocation();
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
              장바구니 <b className="ml-0.5 font-extrabold text-accent">{count}</b>
            </Link>
            <button type="button" className="cursor-pointer rounded border-0 bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-gray-350 hover:bg-chrome-700 hover:text-white">
              로그인
            </button>
            <button type="button" onClick={toggle} className="cursor-pointer rounded border-0 bg-chrome-800 px-3 py-1 text-[length:var(--text-nav)] text-gray-350 hover:bg-chrome-700 hover:text-white">
              테마
            </button>
            <Link to="/upload" className="rounded bg-accent px-3 py-1 text-[length:var(--text-nav)] font-bold text-white no-underline hover:bg-accent-strong">
              에셋 올리기
            </Link>
          </div>
        </div>
      </div>

      {/* 2행 — 대분류. 스크롤 컨테이너로 두면 드롭다운이 잘리므로 줄바꿈으로 흘린다. */}
      <div className="bg-chrome-850">
        <div className="mx-auto flex min-h-[36px] max-w-[1240px] items-center gap-3.5 px-5 py-1.5">
          <div className="flex flex-wrap gap-0.5">
            {GROUPS.map((g) =>
              g.subs ? (
                /* 좁은 화면에서는 드롭다운을 안 쓴다. 숨겨진 메뉴도 폭을 차지해서
                   오른쪽에 붙은 그룹이면 화면 밖으로 밀려 가로 스크롤이 생긴다.
                   대신 하위 항목을 그대로 펼쳐 보여준다 — 어차피 탭 줄이 접힌다. */
                <span
                  key={g.to}
                  className={[
                    "group contents md:relative md:flex",
                    /* 지금 보고 있는 대분류가 아니면 좁은 화면에서 하위를 숨긴다.
                       전부 펼치면 열두 개가 세 줄이 되어 본문보다 크롬이 커진다. */
                    g.subs.some((x) => x.to === pathname) || g.to === pathname
                      ? ""
                      : "[&>span:last-child>a]:hidden md:[&>span:last-child>a]:flex",
                  ].join(" ")}
                >
                  <NavLink to={g.to} className={tabClass} end={g.to === "/"}>
                    {g.label}
                    {g.badge && <sup className="text-[6pt] font-extrabold text-[#FF6B7A]">{g.badge}</sup>}
                    <span className="ml-0.5 hidden text-[6pt] opacity-55 md:inline">▾</span>
                  </NavLink>
                  <span className="contents md:invisible md:absolute md:top-[calc(100%+4px)] md:left-0 md:z-[9600] md:flex md:min-w-[168px] md:-translate-y-1 md:flex-col md:gap-px md:rounded-md md:border md:border-chrome-800 md:bg-chrome-900 md:p-1 md:opacity-0 md:shadow-[0_12px_28px_rgb(0_0_0/0.34)] md:transition-[opacity,translate,visibility] md:duration-150 md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:visible md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
                    {g.subs.map((s) => (
                      <NavLink key={s.to + s.label} to={s.to} className={tabClass}>
                        {s.label}
                        {s.badge && <sup className="text-[6pt] font-extrabold text-[#FF6B7A]">{s.badge}</sup>}
                      </NavLink>
                    ))}
                  </span>
                </span>
              ) : (
                <NavLink key={g.to} to={g.to} className={tabClass} end={g.to === "/"}>
                  {g.label}
                </NavLink>
              ),
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
