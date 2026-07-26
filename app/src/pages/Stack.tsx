import { useMemo, useState } from "react";
import { GAMES, GAME_CATS, SCALES, type Game } from "../data/games";

/* 게임 스택 — 실제 출시작이 무엇으로 만들어졌는지.
   에셋을 사려는 사람이 제일 먼저 확인하는 건 "내 엔진에 붙나"다. */

export function Stack() {
  const [cat, setCat] = useState<string>("all");
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GAMES.filter(
      (g) =>
        (cat === "all" || g.cat === cat) &&
        (!onlyConfirmed || g.ok === 1) &&
        (!needle ||
          g.n.toLowerCase().includes(needle) ||
          g.eng.toLowerCase().includes(needle) ||
          g.dev.toLowerCase().includes(needle)),
    ).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.yr - a.yr);
  }, [cat, onlyConfirmed, q]);

  /* 엔진 점유는 목록에서 직접 센다. 따로 적어 두면 게임이 늘 때마다 어긋난다. */
  const engines = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of list) m.set(g.eng, (m.get(g.eng) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [list]);

  const confirmed = GAMES.filter((g) => g.ok === 1).length;

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">게임 스택</p>
        <h1 className="mt-1 text-4xl font-bold text-ink">출시작이 무엇으로 만들어졌는지 봅니다</h1>
        <p className="mt-2 text-base text-muted">
          엔진과 제작 도구를 게임별로 정리했습니다. 에셋을 고르기 전에 붙일 곳부터 확인하세요.
        </p>
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <Stat k="정리한 게임" v={`${GAMES.length}종`} />
          <Stat k="개발사 공개 확인" v={`${confirmed}종`} />
          <Stat k="나머지" v={`업계 추정 ${GAMES.length - confirmed}종`} />
        </dl>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="게임, 엔진, 개발사 검색"
          aria-label="게임 검색"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-5 py-3 text-base text-ink placeholder:text-faint"
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-faint">
          <input
            type="checkbox"
            checked={onlyConfirmed}
            onChange={(e) => setOnlyConfirmed(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          공개 확인된 것만
        </label>
        <span className="text-xs text-faint">
          <b className="text-ink">{list.length}</b> / {GAMES.length}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {GAME_CATS.map(([k, name]) => (
          <button
            key={k}
            type="button"
            onClick={() => setCat(k)}
            aria-pressed={cat === k}
            className={[
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
              cat === k
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {name}
          </button>
        ))}
      </div>

      {engines.length > 0 && (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-faint">이 조건에서 많이 쓰인 엔진</p>
          <div className="mt-3 flex flex-col gap-2">
            {engines.map(([name, n]) => (
              <div key={name} className="grid grid-cols-[130px_minmax(0,1fr)_34px] items-center gap-3 text-xs">
                <span className="truncate text-muted">{name}</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <b
                    className="block h-full bg-accent"
                    style={{ width: `${(n / (engines[0]?.[1] ?? 1)) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums text-ink">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line">
        {list.map((g) => (
          <Row key={g.n} game={g} open={open === g.n} onToggle={() => setOpen(open === g.n ? null : g.n)} />
        ))}
        {list.length === 0 && (
          <p className="py-16 text-center text-base text-faint">조건에 맞는 게임이 없습니다.</p>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-faint">
        개발사가 공개한 자료로 확인된 항목만 확인으로 표시합니다. 나머지는 업계 추정이며 그렇게 적어 뒀습니다.
      </p>
    </main>
  );
}

function Row({ game, open, onToggle }: { game: Game; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_120px_88px_64px] items-center gap-4 bg-surface px-4 py-3.5 text-left hover:bg-surface-2"
      >
        <span className="min-w-0">
          <b className="block truncate text-base font-bold text-ink">{game.n}</b>
          <span className="block truncate text-xs text-faint">{game.dev}</span>
        </span>
        <span className="truncate text-xs text-muted">{game.eng}</span>
        <span className="text-xs text-faint">{SCALES[game.sc] ?? game.sc}</span>
        <span className="text-right text-xs tabular-nums text-faint">{game.yr}</span>
      </button>

      {open && (
        <div className="bg-ground px-4 pt-1 pb-5">
          <p className="max-w-[68ch] text-base leading-relaxed text-muted">{game.note}</p>
          <dl className="mt-4 flex flex-col gap-1.5">
            {game.stack.map(([name, role, ok]) => (
              <div key={name + role} className="flex items-center gap-3 text-xs">
                <dt className="w-40 shrink-0 truncate text-ink">{name}</dt>
                <dd className="m-0 flex-1 text-faint">{role}</dd>
                <dd className="m-0 text-faint">{ok ? "확인" : "추정"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 text-base font-semibold text-ink">{v}</dd>
    </div>
  );
}
