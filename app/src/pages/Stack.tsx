import { useEffect, useMemo, useState } from "react";
import { GAMES, GAME_CATS, SCALES, engineMark, type Game } from "../data/games";
import { Pager } from "../components/Pager";
import { t } from "../lib/locale";

/* 게임별 엔진.

   지금은 33종이지만 200종을 가정하고 짠다. 카탈로그가 커지면 세 가지가 필요하다 —
   상시 검색, 여러 축을 한 번에 좁히는 패싯 필터, 지금 무엇이 걸려 있는지 보여 주는
   표시다. 걸린 필터가 안 보이면 사람들은 걸러진 표를 전체로 오해한다.

   행은 끊어 늘린다. 수백 줄을 한꺼번에 그리면 첫 화면이 늦다. */

const PAGE = 10;

const CAT_LABEL = Object.fromEntries(GAME_CATS) as Record<string, string>;

const YEAR_BANDS: [string, (y: number) => boolean][] = [
  ["2024 이후", (y) => y >= 2024],
  ["2020–2023", (y) => y >= 2020 && y <= 2023],
  ["2015–2019", (y) => y >= 2015 && y <= 2019],
  ["2014 이전", (y) => y <= 2014],
];

const bandOf = (y: number) => YEAR_BANDS.find(([, f]) => f(y))?.[0] ?? "";

/** 게임 하나가 각 축에서 갖는 값. 패싯 계산과 필터가 같은 함수를 쓴다. */
function axesOf(g: Game): Record<string, string> {
  return {
    engine: engineMark(g.eng).family,
    cat: CAT_LABEL[g.cat] ?? g.cat,
    scale: SCALES[g.sc] ?? g.sc,
    year: bandOf(g.yr),
    ok: g.ok ? "공개 확인" : "업계 추정",
  };
}

const AXES: [string, string][] = [
  ["engine", "엔진"],
  ["cat", "분류"],
  ["scale", "규모"],
  ["year", "출시"],
  ["ok", "출처"],
];

type Picked = Record<string, Set<string>>;

export function Stack() {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Picked>({});
  const [page, setPage] = useState(1);

  /* 한 축에 하나만 고른다. 여러 개를 겹쳐 고를 일이 드물고,
     겹치면 지금 무엇이 걸렸는지 읽기가 어려워진다. 같은 값을 다시 누르면 풀린다. */
  const toggle = (axis: string, value: string) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (prev[axis]?.has(value)) delete next[axis];
      else next[axis] = new Set([value]);
      return next;
    });

  const hits = (needle: string, g: Game) =>
    !needle || [g.n, g.eng, g.dev].some((v) => v.toLowerCase().includes(needle));

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GAMES.filter((g) => {
      if (!hits(needle, g)) return false;
      const a = axesOf(g);
      return Object.entries(picked).every(([axis, set]) => set.has(a[axis] ?? ""));
    }).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.yr - a.yr);
  }, [q, picked]);

  /* 패싯 개수는 그 축을 뺀 나머지 조건으로 센다. 안 그러면 하나를 고르는 순간
     같은 축의 다른 선택지가 전부 0 이 되어 더 좁힐 수가 없다. */
  const facets = useMemo(
    () =>
      AXES.map(([key, label]) => {
        const others = Object.entries(picked).filter(([k]) => k !== key);
        const needle = q.trim().toLowerCase();
        const count = new Map<string, number>();
        for (const g of GAMES) {
          if (!hits(needle, g)) continue;
          const a = axesOf(g);
          if (!others.every(([axis, set]) => set.has(a[axis] ?? ""))) continue;
          const v = a[key] ?? "";
          if (v) count.set(v, (count.get(v) ?? 0) + 1);
        }
        return { key, label, values: [...count].sort((x, y) => y[1] - x[1]) };
      }),
    [q, picked],
  );

  const active = Object.entries(picked).flatMap(([axis, set]) => [...set].map((v) => [axis, v] as const));

  useEffect(() => setPage(1), [q, picked]);

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">{t("엔진")}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{t("게임별 엔진")}</h1>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("게임, 엔진, 개발사 검색")}
        aria-label={t("게임 검색")}
        className="mb-6 w-full rounded-full border border-line bg-surface px-5 py-3 text-xs text-ink placeholder:text-faint shadow-[0_1px_8px_rgba(0,0,0,0.35)] outline-none transition-shadow focus:border-accent focus:shadow-[0_2px_16px_rgba(0,0,0,0.5)]"
      />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[184px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-[100px] lg:self-start">
          {facets.map((f) => (
            <details key={f.key} className="group mb-3 border-b border-line pb-3" open={f.key === "engine"}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-ink">
                {t(f.label)}
                {picked[f.key] && (
                  <span className="truncate text-[10px] font-normal text-accent">
                    {t([...picked[f.key]!][0])}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-faint group-open:hidden">+</span>
                <span className="ml-auto hidden text-[10px] text-faint group-open:inline">−</span>
              </summary>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 lg:flex-col lg:gap-1">
                {f.values.map(([v, n]) => {
                  const on = picked[f.key]?.has(v) ?? false;
                  return (
                    <li key={v} className="lg:w-full">
                      <button
                        type="button"
                        onClick={() => toggle(f.key, v)}
                        aria-pressed={on}
                        className={[
                          "flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent py-0.5 text-left text-xs",
                          on ? "font-bold text-accent" : "text-muted hover:text-ink",
                        ].join(" ")}
                      >
                        <span className="truncate">{t(v)}</span>
                        <span className="num ml-auto shrink-0 text-faint">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>

        <div className="min-w-0">
          {/* 걸린 필터를 항상 보여 준다. 안 보이면 걸러진 표를 전체로 오해한다. */}
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <span className="text-xs text-faint">
              <b className="num text-ink">{list.length}</b>
              {list.length !== GAMES.length && <span> / {GAMES.length}</span>}
            </span>
            {active.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked({})}
                aria-label={t("필터 전체 해제")}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-accent px-2.5 py-1 text-xs text-white"
              >
                {active.map(([, v]) => v).join(", ")}
                <span className="opacity-70">✕</span>
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <p className="py-20 text-center text-xs text-faint">{t("조건에 맞는 게임이 없습니다.")}</p>
          ) : (
            <>
              {list.slice((page - 1) * PAGE, page * PAGE).map((g) => (
                <Row key={g.n} game={g} />
              ))}
              <Pager total={list.length} page={page} perPage={PAGE} onGo={setPage} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* 페이지 번호. 한 화면에 열 줄이라 넘길 일이 잦고, 몇 쪽인지가 보여야
   어디쯤 왔는지 안다. 쪽수가 많아지면 앞뒤 두 칸만 남기고 줄인다. */
function Row({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const mark = engineMark(game.eng);

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-col gap-2 bg-transparent py-3.5 text-left hover:bg-surface"
      >
        {/* 게임 이름이 서두다. 사람이 목록에서 찾는 건 이름이라 제일 크고,
            엔진은 그 게임의 속성이므로 아래에서 라벨을 달고 온다. */}
        <span className="flex items-baseline gap-2.5">
          <b className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{game.n}</b>
          <span className="num shrink-0 text-[10px] text-faint">{game.yr}</span>
        </span>

        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-2 text-xs">
            <EngineLogo family={mark.family} />
            <span className="font-semibold text-accent">
              {mark.family}
              {mark.version && <span className="ml-1 font-normal text-muted">{t(mark.version)}</span>}
            </span>
          </span>
          <span className="text-xs text-muted">
            <span className="text-faint">{t("개발사")} </span>
            {game.dev}
          </span>
          <span className="text-xs text-muted">
            <span className="text-faint">{t("규모")} </span>
            {t(SCALES[game.sc] ?? game.sc)}
          </span>
          {game.own && (
            <span className="text-xs text-muted">
              <span className="text-faint">{t("보유")} </span>
              {t(game.own)}
            </span>
          )}
          {typeof game.pos === "number" && game.pos > 0 && (
            <span className="text-xs text-muted">
              <span className="text-faint">{t("긍정")} </span>
              <span className="num">{game.pos.toLocaleString("ko-KR")}</span>
            </span>
          )}
        </span>
      </button>

      {open && (
        <dl className="m-0 grid gap-x-10 pb-4 sm:grid-cols-2">
          {game.stack.map(([name, role, ok]) => (
            <div
              key={name + role}
              className="grid grid-cols-[minmax(0,1fr)_92px_36px] items-center gap-3 border-b border-line-soft py-1.5 text-xs last:border-b-0"
            >
              <dt className="truncate text-ink">{t(name)}</dt>
              <dd className="m-0 truncate text-faint">{t(role)}</dd>
              <dd className={`m-0 text-right ${ok ? "text-accent" : "text-faint"}`}>{ok ? t("확인") : t("추정")}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

const LOGOS: Record<string, string> = {
  Unity: "unity.svg",
  Unreal: "unreal.svg",
  Godot: "godot.svg",
  GameMaker: "gamemaker.png",
  MonoGame: "monogame.svg",
};

/** 계열 로고. 없는 엔진은 첫 글자 타일로 대신한다. 자리가 비면 줄이 흔들린다. */
function EngineLogo({ family }: { family: string }) {
  const logo = LOGOS[family];
  if (logo) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}engines/${logo}`}
        alt=""
        className="h-4 w-8 shrink-0 object-contain opacity-90 [:root[data-theme=dark]_&]:brightness-0 [:root[data-theme=dark]_&]:invert"
      />
    );
  }
  return (
    <span className="grid h-4 w-8 shrink-0 place-items-center rounded-sm border border-line text-[9px] text-faint">
      {family.slice(0, 2).toUpperCase()}
    </span>
  );
}
