import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PIECES, CATS, ENGINES, ENGINE_NAME, type CatKey, type EngineKey } from "../data/pieces";
import { RankIcon, badgeOf } from "../components/Rank";
import { BUNDLES, bundleItems, bundlePrice, bundleScore } from "../data/bundles";
import { Pager } from "../components/Pager";
import { Thumb } from "../components/Thumb";
import { won } from "../lib/format";
import { t } from "../lib/locale";

/* 카드 그리드는 폭에 따라 한 줄에 2~6개가 들어간다. 24는 그 전부로 나누어떨어져서
   어느 폭에서도 마지막 줄이 어색하게 남지 않는다. 패키지는 줄이 높아 10으로 둔다. */
const PER_CARD = 24;
const PER_BUNDLE = 10;

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
    <main className="mx-auto max-w-[1240px] px-5 pb-16">
      <div className="sticky top-[97px] z-50 -mx-5 mb-6 bg-ground/95 px-5 py-4 backdrop-blur">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("에셋 검색")}
          aria-label={t("에셋 검색")}
          className="w-full rounded-full border border-line-soft bg-surface-2 px-5 py-3.5 text-xs text-ink placeholder:text-muted shadow-[0_2px_6px_rgba(0,0,0,0.45)] outline-none transition-[box-shadow,border-color] focus:border-accent focus:shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
        />
      </div>

      <Row label={t("형태")}>
        {(["단품", "패키지"] as const).map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)} count={k === "단품" ? PIECES.length : BUNDLES.length}>
            {t(k)}
          </Chip>
        ))}
      </Row>

      {kind === "패키지" ? null : <Row label={t("분류")}>
        {CATS.map(([k, name]) => (
          <Chip key={k} on={cat === k} onClick={() => setCat(k)} count={catCount(k)}>
            {t(name)}
          </Chip>
        ))}
      </Row>}

      {kind === "패키지" ? null : <Row label={t("엔진")}>
        <Chip on={engine === "any"} onClick={() => setEngine("any")} count={engCount("any")}>
          {t("전체")}
        </Chip>
        {ENGINES.map((k) => (
          <Chip key={k} on={engine === k} onClick={() => setEngine(k)} count={engCount(k)}>
            {ENGINE_NAME[k]}
          </Chip>
        ))}
      </Row>}

      {kind === "패키지" ? null : <Row label={t("점수")}>
        <input
          type="range"
          min={0}
          max={95}
          value={minScore}
          onChange={(e) => setMinScore(+e.target.value)}
          className="w-40 accent-[var(--accent)]"
        />
        <span className="text-xs text-faint">
          <b className="tabular-nums text-ink">{minScore}</b> {t("이상")}
        </span>
      </Row>}

      {kind === "패키지" ? null : <Row label={t("정렬")}>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink"
        >
          {SORTS.map(([k, name]) => (
            <option key={k} value={k}>
              {t(name)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reset}
          className="ml-auto cursor-pointer rounded-lg border border-line bg-transparent px-3 py-2 text-xs text-faint hover:text-ink"
        >
          {t("필터 초기화")}
        </button>
      </Row>}

      {kind === "패키지" ? (
        <div className="mt-6 flex flex-col gap-4">
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
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
          {list.slice((page - 1) * PER_CARD, page * PER_CARD).map((p) => (
            <Link
              key={p.id}
              to={`/market/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface no-underline transition-[border-color,translate] hover:-translate-y-0.5 hover:border-accent"
            >
              {/* 그림 자리는 언제나 정사각이다. 피사체 모양이 달라도 칸이 안 흔들린다. */}
              <div className="relative aspect-square bg-gradient-to-b from-surface-2 to-surface">
                <span className="absolute top-2 left-2 z-10 flex items-center rounded bg-ground/70 p-0.5">
                  <RankIcon badge={badgeOf(p.score)} size={14} />
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
          ))}
        </div>
      )}

      {kind === "단품" && <Pager total={list.length} page={page} perPage={PER_CARD} onGo={setPage} />}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="w-10 flex-none text-xs text-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
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
        "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
        on
          ? "border-transparent bg-ink font-bold text-ground"
          : "border-line bg-transparent text-muted hover:border-accent hover:text-ink",
      ].join(" ")}
    >
      {children} <span className={on ? "opacity-60" : "text-faint"}>{count}</span>
    </button>
  );
}
