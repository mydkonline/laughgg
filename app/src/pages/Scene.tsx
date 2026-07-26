import { useEffect, useMemo, useState } from "react";
import {
  SCENE_GAMES,
  PLACE_MODEL,
  fitReport,
  fitVerdict,
  fitSummary,
  type SceneGame,
} from "../data/scenes";
import { useCart } from "../lib/cart";
import { Pager } from "../components/Pager";
import { Link } from "react-router-dom";
import { PIECES, modelSrc, type Piece } from "../data/pieces";
import { bakeView } from "../three/baker";

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

const rgb = (c: [number, number, number], a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

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

  const active = Object.values(picked).flatMap((set) => [...set]);
  useEffect(() => setPage(1), [q, picked]);
  const game = SCENE_GAMES.find((g) => g.id === id) ?? SCENE_GAMES[0]!;

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">AI 에셋</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">에셋 컨셉트 매핑</h1>
        <p className="mt-2 text-xs text-muted">산 에셋이 우리 게임 컨셉에 맞는지 확인합니다.</p>
      </header>

      {/* 검색이 이 화면의 입구다. 무엇부터 해야 하는지가 한눈에 보여야 한다. */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="우리 게임 찾기"
        aria-label="게임 검색"
        className="mb-6 w-full rounded-full border border-line bg-surface px-5 py-3.5 text-base text-ink placeholder:text-faint focus:border-accent"
      />

      <div className="mb-6 grid gap-x-12 gap-y-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* 왼쪽은 고르는 자리다. 200종이 되면 다 늘어놓을 수 없으니
            엔진 목록과 같은 구조로 간다 — 검색, 드롭다운 패싯, 쪽 번호. */}
        <div>
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
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <span className="text-xs text-faint">
              <b className="num text-ink">{list.length}</b>
              {list.length !== SCENE_GAMES.length && <span> / {SCENE_GAMES.length}</span>}
            </span>
            {active.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked({})}
                aria-label="필터 전체 해제"
                className="flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-accent px-2.5 py-1 text-xs text-white"
              >
                {active.join(", ")}
                <span className="opacity-70">✕</span>
              </button>
            )}
          </div>

          <ul className="m-0 flex list-none flex-col p-0">
            {list.slice((page - 1) * PAGE, page * PAGE).map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setId(g.id)}
                  aria-pressed={g.id === game.id}
                  className={[
                    "flex w-full cursor-pointer items-center gap-3 border-0 border-b border-line bg-transparent py-2.5 text-left",
                    g.id === game.id ? "text-ink" : "text-muted hover:text-ink",
                  ].join(" ")}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.id === game.id ? "ring-2 ring-accent ring-offset-2 ring-offset-ground" : ""}`}
                    style={{ background: g.sw }}
                  />
                  <span className={`truncate text-xs ${g.id === game.id ? "font-bold" : ""}`}>{g.n}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-faint">{g.cat}</span>
                  <span className="w-24 shrink-0 truncate text-right text-[10px] text-faint">{g.sub}</span>
                </button>
              </li>
            ))}
          </ul>

          <Pager total={list.length} page={page} perPage={PAGE} onGo={setPage} />
        </div>
      </div>

      {/* 검토 대상. 어느 에셋을 보고 있는지가 먼저다. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-line pt-5">
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
      </div>

      <FitPanel game={game} piece={piece} />

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-bold text-ink">{game.n}</span>
        <span className="text-xs text-faint">{game.sub}</span>
        <span className="ml-auto text-xs text-faint">에셋</span>
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
              "cursor-pointer rounded-full border px-3 py-1 text-xs",
              fit === v
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {label as string}
          </button>
        ))}
      </div>

      <Stage game={game} fit={fit} />

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {game.note}{" "}
        <span className="text-faint">
          {fit ? "에셋에도 이 게임의 색을 입혔습니다." : "산 그대로 놓아 재질색이 남아 있습니다."}
        </span>
      </p>
    </main>
  );
}

/* 검토 결과.

   사는 사람이 알아야 할 건 셋이다 — 써도 되나, 뭐가 문제인가, 고칠 수 있나.
   축별 수치는 그 셋 중 어느 것도 아니라 아래로 접어 둔다. 0.86 은 기계가 쓰는
   값이고 사람은 "이 게임보다 밝다" 로 판단한다. */
function FitPanel({ game, piece }: { game: SceneGame; piece: Piece }) {
  const report = fitReport(game);
  const verdict = fitVerdict(report.score);
  const tone =
    verdict.tone === "ok" ? "text-accent" : verdict.tone === "warn" ? "text-ink" : "text-[#FF6B7A]";

  return (
    <div className="border-b border-line pb-8">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div>
          <p className="text-xs text-faint">
            {piece.t} → {game.n}
          </p>
          <p className="num mt-2 text-6xl leading-none text-ink">{report.score}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-base font-bold ${tone}`}>{verdict.label}</p>
          <p className="mt-1.5 text-xs text-muted">{fitSummary(game)}</p>
        </div>

        {report.score < 80 && (
          <Link
            to="/workshop"
            className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-white no-underline hover:bg-accent-strong"
          >
            에디터에서 맞추기
          </Link>
        )}
      </div>

      {/* 수치는 확인하고 싶은 사람만 편다. 대부분은 위 세 줄이면 끝난다. */}
      <details className="mt-5">
        <summary className="cursor-pointer text-xs text-faint">축별 수치</summary>
        <dl className="mt-3 grid gap-x-12 gap-y-2 sm:grid-cols-2">
          {report.axes.map((a) => (
            <div key={a.label} className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
              <dt className={`text-xs ${a.gap > 0.2 ? "text-ink" : "text-faint"}`}>{a.label}</dt>
              <dd className="m-0">
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <b
                    className={`block h-full ${a.gap > 0.5 ? "bg-[#FF6B7A]" : a.gap > 0.2 ? "bg-accent" : "bg-chrome-600"}`}
                    style={{ width: `${Math.max(3, a.gap * 100)}%` }}
                  />
                </span>
              </dd>
              <dd className="num m-0 text-right text-xs text-muted">{a.want}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

/* 무대 한 판. 바탕 안개 → 광원 → 에셋 → 비네팅 순으로 쌓고,
   맨 위에 색 보정을 통째로 건다. 순서가 바뀌면 보정이 광원만 먹는다. */
function Stage({ game, fit }: { game: SceneGame; fit: boolean }) {
  const { grade } = game;
  const filter = [
    `brightness(${grade.br})`,
    `contrast(${grade.ct})`,
    `saturate(${grade.sat})`,
    `hue-rotate(${grade.hue}deg)`,
    grade.sep ? `sepia(${grade.sep})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line"
      style={{ background: rgb(game.fog), filter }}
    >
      {game.light.map((l, i) => (
        <span
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${(l.x - l.r) * 100}%`,
            top: `${(l.y - l.r) * 100}%`,
            width: `${l.r * 200}%`,
            height: `${l.r * 200}%`,
            background: `radial-gradient(circle, ${rgb(l.c, l.i)} 0%, ${rgb(l.c, 0)} 70%)`,
          }}
        />
      ))}

      {/* 바닥. 에셋이 공중에 뜬 것처럼 보이지 않게 지평선을 하나 깐다. */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
        style={{ background: `linear-gradient(${rgb(game.fog, 0)}, ${rgb(game.fog, 0.85)})` }}
      />

      {game.place.map((p, i) => (
        <Placed key={p.key + i} keyName={p.key} x={p.x} y={p.y} s={p.s} r={p.r} fit={fit} game={game} />
      ))}

      <span
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 ${game.vig * 160}px ${game.vig * 60}px ${rgb(game.fog, 0.9)}` }}
      />
    </div>
  );
}

/** 무대에 놓인 에셋 하나. 마켓 상품을 구워서 쓴다. */
function Placed({
  keyName,
  x,
  y,
  s,
  r,
  fit,
  game,
}: {
  keyName: string;
  x: number;
  y: number;
  s: number;
  r: number;
  fit: boolean;
  game: SceneGame;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const piece = PIECES.find((p) => p.m === PLACE_MODEL[keyName]);
    const url = piece && modelSrc(piece);
    if (!url) return;
    let alive = true;
    bakeView(url, [1.3, 0.85, 1.6], "pbr")
      .then((u) => alive && setSrc(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [keyName]);

  if (!src) return null;

  /* 맞춤을 켜면 에셋에도 게임의 색을 한 번 더 입힌다. 무대 전체에 거는 보정만으로는
     원본 재질색이 그대로 남아서 파란 배럴이 붉은 지하에 그대로 서 있게 된다.
     끄면 그 어긋남이 그대로 보인다 — 이 제품이 파는 게 그 어긋남을 없애는 일이다. */
  const key = game.light[0]?.c ?? [255, 255, 255];
  const tint = fit
    ? [
        `saturate(${(0.35 + game.grade.sat * 0.4).toFixed(2)})`,
        `brightness(${game.grade.br.toFixed(2)})`,
        `sepia(${(0.3 + game.grade.sep).toFixed(2)})`,
        `hue-rotate(${(Math.atan2(key[2] - key[0], 255) * 40 + game.grade.hue).toFixed(0)}deg)`,
      ].join(" ")
    : "none";

  return (
    <img
      src={src}
      alt=""
      className="pointer-events-none absolute drop-shadow-[0_10px_18px_rgb(0_0_0/0.5)] transition-[filter] duration-500"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        height: `${s * 46}%`,
        translate: "-50% -70%",
        rotate: `${r * 0.4}deg`,
        filter: tint,
      }}
    />
  );
}

