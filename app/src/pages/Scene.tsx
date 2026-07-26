import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SCENE_GAMES, PLACE_MODEL, type SceneGame } from "../data/scenes";
import { PIECES, modelSrc } from "../data/pieces";
import { bakeView } from "../three/baker";

/* AI 에셋 — 같은 에셋을 각 게임의 조명과 색 보정 아래 놓아 본다.
   사려는 사람이 제일 먼저 하는 판단이 "우리 게임에 놔도 되나" 이고,
   그 판단은 글로 설명해서는 안 서고 그림으로 봐야 선다. */

const rgb = (c: [number, number, number], a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

export function Scene() {
  const [id, setId] = useState(SCENE_GAMES[0]!.id);
  const [dim, setDim] = useState<"전체" | "3D" | "2D">("전체");
  /* 맞추기 전과 후를 나란히 볼 수 있어야 이 제품이 무엇을 파는지 보인다. */
  const [fit, setFit] = useState(true);

  const list = useMemo(
    () => (dim === "전체" ? SCENE_GAMES : SCENE_GAMES.filter((g) => g.dim === dim)),
    [dim],
  );
  const game = SCENE_GAMES.find((g) => g.id === id) ?? SCENE_GAMES[0]!;

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">AI 에셋</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">에셋 매핑</h1>
        <p className="mt-2 text-xs text-muted">같은 에셋을 게임별 조명과 색 보정에 대응시킵니다.</p>
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <Spec k="비교 게임" v={`${SCENE_GAMES.length}종`} />
          <Spec k="적용 항목" v="조명, 색 보정, 안개, 비네팅" />
          <Spec k="에셋" v="마켓 실제 상품" />
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["전체", "3D", "2D"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDim(d)}
            aria-pressed={dim === d}
            className={[
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
              dim === d
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {d}
            <span className={dim === d ? "ml-1.5 opacity-60" : "ml-1.5 text-faint"}>
              {d === "전체" ? SCENE_GAMES.length : SCENE_GAMES.filter((g) => g.dim === d).length}
            </span>
          </button>
        ))}
      </div>

      {/* 게임 목록. 대표색을 칩에 물려 두면 고르기 전에도 톤이 짐작된다. */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-2">
        {list.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setId(g.id)}
            aria-pressed={g.id === game.id}
            className={[
              "flex flex-none cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs whitespace-nowrap",
              g.id === game.id
                ? "border-accent bg-surface font-bold text-ink"
                : "border-line text-muted hover:text-ink",
            ].join(" ")}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.sw }} />
            {g.n}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-faint">에셋 상태</span>
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

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="text-xs leading-relaxed text-muted">{game.note}</p>
          <p className="mt-2 text-xs text-faint">
            {fit
              ? "에셋에도 이 게임의 색을 입혔습니다. 스튜디오 에디터가 하는 일이 이겁니다."
              : "에셋을 산 그대로 놓았습니다. 재질색이 남아 배경과 따로 놉니다."}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-4 lg:grid-cols-2">
          <Meta k="밝기" v={game.grade.br.toFixed(2)} />
          <Meta k="대비" v={game.grade.ct.toFixed(2)} />
          <Meta k="채도" v={game.grade.sat.toFixed(2)} />
          <Meta k="색조" v={`${game.grade.hue > 0 ? "+" : ""}${game.grade.hue}°`} />
        </dl>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <Link to="/workshop" className="text-xs text-faint no-underline hover:text-ink">
          이 톤으로 내 에셋 맞추기 →
        </Link>
        <p className="text-xs text-faint">
          <b className="text-muted">데모.</b> 게임 화면이 아니라 각 게임의 색 보정값을 재현한 무대입니다.
          상용 스크린샷은 저작권 때문에 쓰지 않습니다.
        </p>
      </div>
    </main>
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

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 text-xs font-semibold text-ink">{v}</dd>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="num m-0 text-base text-ink">{v}</dd>
    </div>
  );
}
