import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PIECES, CATS, ENGINES, ENGINE_NAME, type CatKey, type EngineKey } from "../data/pieces";
import { RankIcon, badgeOf } from "../components/Rank";
import { Thumb } from "../components/Thumb";
import { won } from "../lib/format";

type Sort = "score" | "dl" | "new" | "price";

const SORTS: [Sort, string][] = [
  ["score", "분석 점수순"],
  ["dl", "내려받기순"],
  ["new", "최신순"],
  ["price", "가격순"],
];

export function Market() {
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
        <div className="flex flex-wrap items-center gap-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="에셋 검색 — 보스전, 인벤토리, 히트스톱…"
            aria-label="에셋 검색"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-5 py-3 text-base text-ink placeholder:text-faint"
          />
          <label className="flex items-center gap-3 text-xs text-faint">
            분석 점수
            <input
              type="range"
              min={0}
              max={95}
              value={minScore}
              onChange={(e) => setMinScore(+e.target.value)}
              className="w-40 accent-[var(--accent)]"
            />
            <b className="tabular-nums text-ink">{minScore}</b> 이상
          </label>
          <span className="text-xs text-faint">
            <b className="text-ink">{list.length}</b> / {PIECES.length}
          </span>
        </div>
      </div>

      <Row label="분류">
        {CATS.map(([k, name]) => (
          <Chip key={k} on={cat === k} onClick={() => setCat(k)} count={catCount(k)}>
            {name}
          </Chip>
        ))}
      </Row>

      <Row label="엔진">
        <Chip on={engine === "any"} onClick={() => setEngine("any")} count={engCount("any")}>
          전체
        </Chip>
        {ENGINES.map((k) => (
          <Chip key={k} on={engine === k} onClick={() => setEngine(k)} count={engCount(k)}>
            {ENGINE_NAME[k]}
          </Chip>
        ))}
      </Row>

      <Row label="정렬">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink"
        >
          {SORTS.map(([k, name]) => (
            <option key={k} value={k}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reset}
          className="ml-auto cursor-pointer rounded-lg border border-line bg-transparent px-3 py-2 text-xs text-faint hover:text-ink"
        >
          필터 초기화
        </button>
      </Row>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-line py-20 text-center text-base text-faint">
          조건에 맞는 에셋이 없습니다. 점수 기준을 낮추거나 분류를 넓혀 보세요.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
          {list.map((p) => (
            <Link
              key={p.id}
              to={`/market/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface no-underline transition-[border-color,translate] hover:-translate-y-0.5 hover:border-accent"
            >
              <div className="relative aspect-[4/3] bg-gradient-to-b from-surface-2 to-surface p-4">
                <span className="absolute top-2.5 left-2.5 z-10 flex items-center rounded bg-ground/70 p-1">
                  <RankIcon badge={badgeOf(p.score)} size={18} />
                </span>
                <Thumb piece={p} className="drop-shadow-[0_6px_14px_rgb(0_0_0/0.28)]" />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <span className="text-xs font-bold text-ink">{p.t}</span>
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
