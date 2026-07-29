import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PIECES, CATS, ENGINES, ENGINE_NAME, type CatKey, type EngineKey, type Piece } from "../data/pieces";
import { RankIcon, badgeOf } from "../components/Rank";
import { BUNDLES, bundleItems, bundlePrice, bundleScore } from "../data/bundles";
import { Pager } from "../components/Pager";
import { Thumb } from "../components/Thumb";
import { ReuseBadge } from "../components/ReuseBadge";
import { won } from "../lib/format";
import { t } from "../lib/locale";

/* 카드 그리드는 폭에 따라 한 줄에 2~6개가 들어간다. 24는 그 전부로 나누어떨어져서
   어느 폭에서도 마지막 줄이 어색하게 남지 않는다. 패키지는 줄이 높아 10으로 둔다. */
const PER_CARD = 24;
const PER_BUNDLE = 10;
/* 전체 화면에서 분류 선반 하나에 미리 보여 줄 개수. 넘치면 "전체 보기"로 넘긴다. */
const SHELF = 12;

type Sort = "score" | "dl" | "new" | "price";

const SORTS: [Sort, string][] = [
  ["score", "분석 점수순"],
  ["dl", "내려받기순"],
  ["new", "최신순"],
  ["price", "가격순"],
];

export function Market() {
  /* 패키지와 단품을 한 칸에 섞지 않는다. 개수도 가격도 기준이 달라
     같이 놓으면 비교가 깨진다. */
  const [kind, setKind] = useState<"단품" | "패키지">("단품");
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState<CatKey>("all");
  const [engine, setEngine] = useState<EngineKey | "any">("any");
  const [minScore, setMinScore] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("score");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PIECES.filter(
      (p) =>
        (cat === "all" || p.cat === cat) &&
        (engine === "any" || p.eng.includes(engine)) &&
        p.score >= minScore &&
        (!needle || p.t.toLowerCase().includes(needle) || p.by.toLowerCase().includes(needle)),
    ).sort((a, b) =>
      sort === "score" ? b.score - a.score
      : sort === "dl" ? b.dl - a.dl
      : sort === "new" ? a.days - b.days
      : a.price - b.price,
    );
  }, [cat, engine, minScore, q, sort]);

  /* 칩에 붙는 수는 나머지 조건을 고정한 채 그 분류만 세어야 쓸모가 있다. */
  const catCount = (k: CatKey) =>
    PIECES.filter((p) => (k === "all" || p.cat === k) && (engine === "any" || p.eng.includes(engine)) && p.score >= minScore).length;
  const engCount = (k: EngineKey | "any") =>
    PIECES.filter((p) => (cat === "all" || p.cat === cat) && (k === "any" || p.eng.includes(k)) && p.score >= minScore).length;

  /* 조건이 바뀌면 첫 쪽으로 돌아간다. 3쪽을 보다 필터를 걸면 빈 화면이 나온다. */
  useEffect(() => setPage(1), [cat, engine, minScore, q, sort, kind]);

  const reset = () => {
    setCat("all");
    setEngine("any");
    setMinScore(0);
    setQ("");
    setSort("score");
  };

  return (
    <main className="mx-auto max-w-[1240px] px-5 pt-8 pb-16">
      {/* 검색은 제자리에 둔다. sticky 로 띄우면 반투명 배경 뒤로 카드가 비치고,
          그 박스 배경이 본문 그라데이션과 달라 이음매가 생겨 깨져 보였다. 스크롤
          중 항상 필요한 건 분류 필터라, 그건 왼쪽 사이드바가 sticky 로 잡는다. */}
      <div className="mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("에셋 검색")}
          aria-label={t("에셋 검색")}
          className="w-full rounded-full border border-line-soft bg-surface-2 px-5 py-3.5 text-xs text-ink placeholder:text-muted shadow-[0_2px_6px_rgba(0,0,0,0.45)] outline-none transition-[box-shadow,border-color] focus:border-accent focus:shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
        />
      </div>

      {/* 왼쪽 필터 사이드바 + 오른쪽 결과. 가로 칩 줄은 분류가 늘수록 접혀 지저분
          하고 고르기 혼란스럽다 — 전자상거래 표준(Baymard)이자 이 앱 Scene 페이지와
          같은 세로 패싯 사이드바로 간다. 세로 목록이라 분류가 수십 개로 늘어도
          안 깨지고, 부차적 그룹은 접어 인지 부하를 낮춘다. 좁은 화면에서는 결과가
          먼저 오고 필터가 아래로 쌓인다. */}
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="order-2 lg:order-1 lg:sticky lg:top-[100px] lg:self-start">
          {/* 형태 — 단품/패키지. 다른 필터의 켜짐을 가르는 축이라 맨 위 세그먼트로. */}
          <div className="mb-4 flex gap-1 rounded-full border border-line p-0.5">
            {(["단품", "패키지"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={[
                  "flex-1 cursor-pointer rounded-full py-1.5 text-xs",
                  kind === k ? "bg-ink font-bold text-ground" : "text-muted hover:text-ink",
                ].join(" ")}
              >
                {t(k)}{" "}
                <span className={kind === k ? "opacity-60" : "text-faint"}>
                  {k === "단품" ? PIECES.length : BUNDLES.length}
                </span>
              </button>
            ))}
          </div>

          {kind === "단품" && (
            <>
              <FacetGroup label={t("분류")}>
                <FacetItem on={cat === "all"} count={catCount("all")} onClick={() => setCat("all")}>
                  {t("전체")}
                </FacetItem>
                {CATS.filter(([k]) => k !== "all").map(([k, name]) => (
                  <FacetItem key={k} on={cat === k} count={catCount(k)} onClick={() => setCat(k)}>
                    {t(name)}
                  </FacetItem>
                ))}
              </FacetGroup>

              <FacetGroup label={t("엔진")}>
                <FacetItem on={engine === "any"} count={engCount("any")} onClick={() => setEngine("any")}>
                  {t("전체")}
                </FacetItem>
                {ENGINES.map((k) => (
                  <FacetItem key={k} on={engine === k} count={engCount(k)} onClick={() => setEngine(k)}>
                    {ENGINE_NAME[k]}
                  </FacetItem>
                ))}
              </FacetGroup>

              <FacetGroup label={t("점수")}>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min={0}
                    max={95}
                    value={minScore}
                    onChange={(e) => setMinScore(+e.target.value)}
                    className="w-full accent-[var(--accent)]"
                  />
                  <span className="shrink-0 text-xs text-faint">
                    <b className="tabular-nums text-ink">{minScore}</b> {t("이상")}
                  </span>
                </div>
              </FacetGroup>

              <FacetGroup label={t("정렬")}>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink"
                >
                  {SORTS.map(([k, name]) => (
                    <option key={k} value={k}>
                      {t(name)}
                    </option>
                  ))}
                </select>
              </FacetGroup>

              <button
                type="button"
                onClick={reset}
                className="mt-4 cursor-pointer text-xs text-faint hover:text-ink"
              >
                {t("필터 초기화")}
              </button>
            </>
          )}
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
      {kind === "패키지" ? (
        <div className="flex flex-col gap-4">
          {BUNDLES.slice((page - 1) * PER_BUNDLE, page * PER_BUNDLE).map((b) => {
            const items = bundleItems(b);
            const price = bundlePrice(b);
            return (
              <Link
                key={b.id}
                to={`/market/${items[0]?.id ?? 1}`}
                className="grid gap-x-8 gap-y-4 border-b border-line pb-5 no-underline sm:grid-cols-[minmax(0,1fr)_180px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-base font-bold text-ink">{t(b.name)}</span>
                    <span className="text-xs text-faint">{t("{n}종", { n: items.length })}</span>
                    <span className="flex items-center gap-1">
                      <RankIcon badge={badgeOf(bundleScore(b))} size={13} />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-faint">{t(b.note)}</p>

                  {/* 안에 무엇이 들었는지 낱개로 다 보인다. 안 보이면 못 산다. */}
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {items.map((p) => (
                      <span key={p.id} className="w-16 flex-none">
                        <span className="relative block aspect-square rounded-md bg-surface">
                          <Thumb piece={p} pad="12%" />
                        </span>
                        <span className="block truncate pt-1 text-[10px] text-faint">{p.t}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 낱개 합계와 나란히 낸다. 얼마를 아끼는지가 사는 이유다. */}
                <div className="sm:border-l sm:border-line sm:pl-6">
                  <p className="text-xs text-faint line-through">{won(price.single)}</p>
                  <p className="num mt-0.5 text-4xl leading-none text-ink">{won(price.bundled)}</p>
                  <p className="mt-1.5 text-xs text-accent">{t("{v} 절약", { v: won(price.saved) })}</p>
                </div>
              </Link>
            );
          })}
          <Pager total={BUNDLES.length} page={page} perPage={PER_BUNDLE} onGo={setPage} />
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-line py-20 text-center text-base text-faint">
          {t("조건에 맞는 에셋이 없습니다. 점수 기준을 낮추거나 분류를 넓혀 보세요.")}
        </p>
      ) : cat === "all" ? (
        /* 전체는 유형을 한 격자에 뒤섞지 않는다 — 섞으면 3D·소리·재질·UI 가
           제각각이라 지저분해진다. 에셋 스토어처럼 분류별 선반으로 나눠, 한 줄엔
           같은 유형만 담고 넘치면 가로로 민다. 더 보려면 그 분류로 들어간다. */
        <div className="flex flex-col gap-9">
          {CATS.filter(([k]) => k !== "all").map(([k, name]) => {
            const items = list.filter((p) => p.cat === k);
            if (!items.length) return null;
            return (
              <Shelf
                key={k}
                title={t(name)}
                total={items.length}
                items={items.slice(0, SHELF)}
                onSeeAll={items.length > SHELF ? () => setCat(k) : undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
          {list.slice((page - 1) * PER_CARD, page * PER_CARD).map((p) => (
            <Card key={p.id} piece={p} />
          ))}
        </div>
      )}

          {kind === "단품" && cat !== "all" && (
            <Pager total={list.length} page={page} perPage={PER_CARD} onGo={setPage} />
          )}
        </div>
      </div>
    </main>
  );
}

/* 필터 패싯 그룹. 아코디언으로 접힌다 — 그룹이 늘어도 접어서 인지 부하를 낮춘다
   (Baymard: 부차적 그룹은 접고 핵심은 편다). 기본은 펴 두고, 사용자가 접을 수 있다. */
function FacetGroup({ label, children, open = true }: { label: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-b border-line py-3" open={open}>
      <summary className="flex cursor-pointer list-none items-center text-xs font-bold text-ink">
        {label}
        <span className="ml-auto text-[10px] text-faint group-open:hidden">+</span>
        <span className="ml-auto hidden text-[10px] text-faint group-open:inline">−</span>
      </summary>
      <div className="mt-2 flex flex-col">{children}</div>
    </details>
  );
}

/* 패싯 한 줄. 세로 목록이라 개수가 늘어도 스캔하기 쉽고 안 깨진다. 오른쪽에
   현재 조건 기준 개수를 붙여, 고르기 전에 몇 개인지 보인다. */
function FacetItem({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={[
        "flex w-full cursor-pointer items-center gap-2 py-1 text-left text-xs",
        on ? "font-bold text-accent" : "text-muted hover:text-ink",
      ].join(" ")}
    >
      <span className="truncate">{children}</span>
      <span className={`ml-auto shrink-0 tabular-nums ${on ? "text-accent" : "text-faint"}`}>{count}</span>
    </button>
  );
}

/* 분류 선반 하나. 상품이 늘면 선반이 화면보다 길어진다 — 스크롤바는 숨겨
   깔끔하게 두되, 마우스로도 옆으로 넘길 수 있게 좌우 화살표를 얹는다. 끝에
   닿으면 그쪽 화살표를 감춰 더 갈 곳이 없다는 걸 알린다. 트랙패드는 그냥 쓸면 된다. */
function Shelf({
  title,
  total,
  items,
  onSeeAll,
}: {
  title: string;
  total: number;
  items: Piece[];
  onSeeAll?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState({ start: true, end: false, over: false });
  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setNav({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      over: el.scrollWidth > el.clientWidth + 2,
    });
  };
  useEffect(() => {
    sync();
  }, [items]);
  const page = (dir: number) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section>
      {/* 넘길 화살표는 카드 위에 겹치면 카드가 눌려 버린다 — 헤더 오른쪽(카드
          바깥)에 두고, 끝에 닿으면 그쪽을 흐린다. 넘칠 때만 뜬다. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {title} <span className="text-xs font-normal text-faint">{total}</span>
        </h2>
        <div className="flex items-center gap-3">
          {nav.over && (
            <div className="flex items-center gap-1">
              <ArrowBtn dir={-1} disabled={nav.start} onClick={() => page(-1)} />
              <ArrowBtn dir={1} disabled={nav.end} onClick={() => page(1)} />
            </div>
          )}
          {onSeeAll && (
            <button
              type="button"
              onClick={onSeeAll}
              className="shrink-0 cursor-pointer text-xs font-semibold text-accent hover:underline"
            >
              {t("전체 보기")}
            </button>
          )}
        </div>
      </div>
      <div
        ref={ref}
        onScroll={sync}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((p) => (
          <Card key={p.id} piece={p} className="w-[168px] shrink-0" />
        ))}
      </div>
    </section>
  );
}

/* 선반 넘김 버튼. 헤더에 놓여 카드와 안 겹친다. 끝이면 disabled 로 흐린다. */
function ArrowBtn({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? t("이전") : t("다음")}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-line pb-0.5 text-sm text-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-default disabled:border-line disabled:text-faint disabled:opacity-40 disabled:hover:text-faint"
    >
      {dir < 0 ? "‹" : "›"}
    </button>
  );
}

/* 상품 카드 하나. 전체 화면의 분류 선반과 특정 분류의 격자가 같은 카드를 쓴다 —
   한쪽만 바뀌면 두 화면이 어긋난다. 선반에서는 className 으로 고정 폭을 준다. */
function Card({ piece: p, className = "" }: { piece: Piece; className?: string }) {
  return (
    <Link
      to={`/market/${p.id}`}
      className={`group flex flex-col overflow-hidden rounded-xl border border-line bg-surface no-underline transition-[border-color,translate] hover:-translate-y-0.5 hover:border-accent ${className}`}
    >
      {/* 그림 자리는 언제나 정사각이다. 피사체 모양이 달라도 칸이 안 흔들린다. */}
      <div className="relative aspect-square bg-gradient-to-b from-surface-2 to-surface">
        <span className="absolute top-2 left-2 z-10 flex items-center rounded bg-ground/70 p-0.5">
          <RankIcon badge={badgeOf(p.score)} size={14} />
        </span>
        {/* 재사용 난도. 이 마켓의 핵심 신호라 표지처럼 오른쪽 위에 올린다. */}
        <span className="absolute top-2 right-2 z-10">
          <ReuseBadge cat={p.cat} className="bg-ground/70 backdrop-blur-sm" />
        </span>
        <Thumb piece={p} className="drop-shadow-[0_4px_10px_rgb(0_0_0/0.28)]" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="truncate text-xs font-bold text-ink">{p.t}</span>
        <div className="mt-auto flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-ink">{won(p.price)}</span>
          <span className="truncate text-xs text-faint">
            {p.eng.map((e) => ENGINE_NAME[e]).join(", ")}
          </span>
        </div>
      </div>
    </Link>
  );
}
