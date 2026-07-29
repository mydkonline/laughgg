import { useEffect, useMemo, useState } from "react";
import { SCENE_GAMES, type SceneGame } from "../data/scenes";
import { GAME_LOGOS } from "../data/logos";
import { SCENES_EN } from "../i18n/en/scenes";
import { localized } from "../lib/locale";
import { useCart } from "../lib/cart";
import { Pager } from "../components/Pager";
import { PIECES, CAT_NAME } from "../data/pieces";
import { REUSE_AXIS } from "../data/reuse";
import { ReuseBadge } from "../components/ReuseBadge";
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
    <main className="mx-auto max-w-[1240px] px-5 pt-8 pb-20">

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
            className="mb-4 w-full rounded-full border border-line-soft bg-surface-2 px-4 py-3 text-xs text-ink placeholder:text-muted shadow-[0_2px_6px_rgba(0,0,0,0.45)] outline-none transition-[box-shadow,border-color] focus:border-accent focus:shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          />

          {facets.map((f) => (
            <details key={f.key} className="group mb-3 border-b border-line pb-3" open={f.key === "cat"}>
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
                        <span className="truncate">{t(v)}</span>
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
                  {/* 로고를 그라디언트 정사각 타일에 담는다. 로고 색·밝기가
                      제각각이라(검은 워드마크는 다크 배경에서 안 보였다) 밝은↔
                      어두운 톤이 함께 있는 그라디언트를 깔면 어느 로고든 대비가
                      생겨 읽힌다. 로고 없는 게임은 같은 타일에 스와치색을 채운다. */}
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border p-1 ${
                      g.id === game.id ? "border-accent" : "border-line"
                    }`}
                    style={
                      GAME_LOGOS.has(g.id)
                        ? { background: "linear-gradient(135deg, #47474f 0%, #1b1b1f 100%)" }
                        : { background: g.sw }
                    }
                  >
                    {GAME_LOGOS.has(g.id) && (
                      <img
                        src={`${import.meta.env.BASE_URL}assets/logos/${g.id}.png`}
                        alt=""
                        loading="lazy"
                        className={`max-h-full max-w-full object-contain ${g.id === game.id ? "" : "opacity-90"}`}
                      />
                    )}
                  </span>
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
          </div>

          <Stage game={game} fit hero={piece?.m} editable />

          {/* 어떤 에셋을 올려 볼지. 고른 것이 무대 앞자리에 선다. 산 에셋이
              많을 수 있어 줄바꿈 대신 한 줄 가로 스크롤로 둔다 — 늘어도 안 깨진다. */}
          <div className="mt-3 flex items-center gap-2">
            <span className="shrink-0 text-xs text-faint">{t(cartIds.length ? "산 에셋" : "마켓 상위")}</span>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {owned.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPieceId(p.id)}
                  aria-pressed={p.id === piece.id}
                  className={[
                    "shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-xs",
                    p.id === piece.id
                      ? "border-transparent bg-ink font-bold text-ground"
                      : "border-line text-muted hover:border-accent hover:text-ink",
                  ].join(" ")}
                >
                  {p.t}
                </button>
              ))}
            </div>
          </div>

          {/* 궁합 한 줄. 무대는 "이 게임에 맞췄나"를 보여 주지만, 이 마켓의 진짜
              질문은 "이 에셋이 다른 프로젝트에서도 계속 쓰이나"다. 에셋을 심판하지
              않고, 이 유형의 재사용 난도를 알려 장롱을 피하게 한다. */}
          {REUSE_AXIS[piece.cat] && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
              <b className="text-muted">{t(CAT_NAME[piece.cat])}</b>
              <ReuseBadge cat={piece.cat} />
              <span>{t(REUSE_AXIS[piece.cat]!.note)}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
