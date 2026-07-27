import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SCENE_GAMES, type SceneGame } from "../data/scenes";
import { SCENES_EN } from "../i18n/en/scenes";
import { localized } from "../lib/locale";
import { useCart } from "../lib/cart";
import { Pager } from "../components/Pager";
import { PIECES } from "../data/pieces";
import { Stage } from "../components/GameStage";
import { t } from "../lib/locale";

/* 산 에셋이 우리 게임에 맞는가.

   에셋은 스튜디오 조명 아래 중립으로 구워져 있다. 게임이 요구하는 값과 얼마나
   떨어져 있는지를 축마다 재서 먼저 알려 주고, 그다음 눈으로 확인시킨다.
   숫자만 있으면 못 믿고, 그림만 있으면 어디를 고쳐야 하는지 모른다. */

const PAGE = 10;

const SCENE_AXES: [string, string][] = [
  ["cat", "시각 방향"],
  ["sub", "분위기"],
  ["dim", "차원"],
];

export function Scene() {
  const [id, setId] = useState(SCENE_GAMES[0]!.id);
  /* 맞추기 전과 후를 나란히 볼 수 있어야 이 제품이 무엇을 파는지 보인다. */
  const [fit, setFit] = useState(true);
  const { ids: cartIds } = useCart();
  /* 검토 대상은 산 에셋이다. 장바구니가 비면 마켓 상위를 올려 둔다. */
  const owned = useMemo(() => {
    const inCart = PIECES.filter((p) => cartIds.includes(p.id) && p.m);
    return inCart.length ? inCart : PIECES.filter((p) => p.m).slice(0, 6);
  }, [cartIds]);
  const [pieceId, setPieceId] = useState(() => owned[0]?.id ?? 1);
  const piece = owned.find((p) => p.id === pieceId) ?? owned[0]!;

  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, Set<string>>>({});
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

  const axesOf = (g: SceneGame): Record<string, string> => ({ cat: g.cat, sub: g.sub, dim: g.dim });
  const hits = (needle: string, g: SceneGame) =>
    !needle || [g.n, g.sub, g.cat].some((v) => v.toLowerCase().includes(needle));

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return SCENE_GAMES.filter((g) => {
      if (!hits(needle, g)) return false;
      const a = axesOf(g);
      return Object.entries(picked).every(([axis, set]) => set.has(a[axis] ?? ""));
    });
  }, [q, picked]);

  /* 패싯 개수는 그 축을 뺀 나머지 조건으로 센다. 안 그러면 하나 고르는 순간
     같은 축의 다른 선택지가 전부 0 이 된다. */
  const facets = useMemo(
    () =>
      SCENE_AXES.map(([key, label]) => {
        const others = Object.entries(picked).filter(([k]) => k !== key);
        const needle = q.trim().toLowerCase();
        const count = new Map<string, number>();
        for (const g of SCENE_GAMES) {
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

  useEffect(() => setPage(1), [q, picked]);
  const chosen = SCENE_GAMES.find((g) => g.id === id) ?? SCENE_GAMES[0]!;
  // 레코드를 지금 언어로 겹쳐 읽는다. 안 옮긴 필드는 한국어가 남는다.
  const game = localized(SCENES_EN, chosen.id, chosen);

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">{t("AI 에셋")}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{t("에셋 컨셉트 매핑")}</h1>
        <p className="mt-2 text-xs text-muted">{t("산 에셋이 우리 게임 컨셉에 맞는지 확인합니다.")}</p>
      </header>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* 고르는 자리는 왼쪽으로 몬다. 오른쪽은 시연만 본다.
            좁은 화면에서는 좌우가 위아래로 쌓이는데, 그대로 두면 게임 196개
            목록을 다 지나야 시연이 나온다. 이 페이지에서 제일 먼저 보여야 할
            것은 시연이므로 순서를 뒤집는다. */}
        <div className="order-2 lg:order-1 lg:sticky lg:top-[100px] lg:self-start">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("게임 찾기")}
            aria-label={t("게임 검색")}
            className="mb-4 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-xs text-ink placeholder:text-faint focus:border-accent"
          />

          {facets.map((f) => (
            <details key={f.key} className="group mb-3 border-b border-line pb-3" open={f.key === "cat"}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-ink">
                {f.label}
                {picked[f.key] && (
                  <span className="truncate text-[10px] font-normal text-accent">
                    {[...picked[f.key]!][0]}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-faint group-open:hidden">+</span>
                <span className="ml-auto hidden text-[10px] text-faint group-open:inline">−</span>
              </summary>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                {f.values.map(([v, n]) => {
                  const on = picked[f.key]?.has(v) ?? false;
                  return (
                    <li key={v}>
                      <button
                        type="button"
                        onClick={() => toggle(f.key, v)}
                        aria-pressed={on}
                        className={[
                          "flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent py-0.5 text-left text-xs",
                          on ? "font-bold text-accent" : "text-muted hover:text-ink",
                        ].join(" ")}
                      >
                        <span className="truncate">{v}</span>
                        <span className="num ml-auto shrink-0 text-faint">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}

          <p className="mt-4 mb-2 text-xs text-faint">
            <b className="num text-ink">{list.length}</b>
            {list.length !== SCENE_GAMES.length && <span> / {SCENE_GAMES.length}</span>}
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {list.slice((page - 1) * PAGE, page * PAGE).map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setId(g.id)}
                  aria-pressed={g.id === game.id}
                  className={[
                    "flex w-full cursor-pointer items-center gap-2.5 border-0 border-b border-line bg-transparent py-2 text-left",
                    g.id === game.id ? "text-ink" : "text-muted hover:text-ink",
                  ].join(" ")}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.id === game.id ? "ring-2 ring-accent ring-offset-2 ring-offset-ground" : ""}`}
                    style={{ background: g.sw }}
                  />
                  <span className={`truncate text-xs ${g.id === game.id ? "font-bold" : ""}`}>
                    {localized(SCENES_EN, g.id, g).n}
                  </span>
                  {g.guess && <span className="shrink-0 text-[10px] text-faint">{t("추정")}</span>}
                  <span className="ml-auto shrink-0 text-[10px] text-faint">{t(g.sub)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pager total={list.length} page={page} perPage={PAGE} onGo={setPage} />
        </div>

        {/* 시연. 이 화면에서 제일 크게 보여야 하는 것이다. */}
        <div className="order-1 min-w-0 lg:order-2">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-base font-bold text-ink">{game.n}</span>
            <span className="text-xs text-faint">
              {t(game.cat)}, {t(game.sub)}
            </span>
            {game.guess && (
              <span className="rounded border border-line px-1.5 py-px text-[10px] text-faint">
                {t("장르에서 추정한 값")}
              </span>
            )}
            <span className="ml-auto flex overflow-hidden rounded-full border border-line">
              {[
                [false, "원본 그대로"],
                [true, "이 게임에 맞춤"],
              ].map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setFit(v as boolean)}
                  aria-pressed={fit === v}
                  className={[
                    "cursor-pointer border-0 px-3 py-1 text-xs",
                    fit === v ? "bg-ink font-bold text-ground" : "bg-transparent text-muted hover:text-ink",
                  ].join(" ")}
                >
                  {label as string}
                </button>
              ))}
            </span>
          </div>

          <Stage game={game} fit={fit} hero={piece?.m} />

          {/* 어떤 에셋을 올려 볼지. 고른 것이 무대 앞자리에 선다. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">{cartIds.length ? "산 에셋" : "마켓 상위"}</span>
            {owned.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPieceId(p.id)}
                aria-pressed={p.id === piece.id}
                className={[
                  "cursor-pointer rounded-full border px-3 py-1 text-xs",
                  p.id === piece.id
                    ? "border-transparent bg-ink font-bold text-ground"
                    : "border-line text-muted hover:border-accent hover:text-ink",
                ].join(" ")}
              >
                {p.t}
              </button>
            ))}
            {/* 확인 다음에 할 일. 없으면 이 화면이 막다른 길이 된다. */}
            <Link
              to={`/workshop?piece=${piece.id}`}
              className="ml-auto text-xs font-semibold text-accent no-underline hover:underline"
            >
              {t("에디터에서 맞추기")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
