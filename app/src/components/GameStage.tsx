import { useEffect, useState } from "react";

import { PLACE_MODEL, type SceneGame } from "../data/scenes";
import { PIECES, modelSrc } from "../data/pieces";
import { bakeView } from "../three/baker";

/* 게임 무대.

   에셋은 스튜디오 조명 아래 중립으로 구워져 있다. 그 상태로 게임에 넣으면
   혼자 튄다 — 이 컴포넌트가 파는 게 바로 그 어긋남을 없애는 일이라,
   홈과 씬 페이지가 같은 그림을 쓴다. 둘이 갈리면 홈에서 본 것과 들어가서
   본 것이 달라진다.

   렌더러를 새로 띄우지 않는다. 공용 베이커가 구운 데이터 URL 을 쓰므로
   무대가 여러 개 떠도 WebGL 컨텍스트를 더 먹지 않는다. */

const rgb = (c: [number, number, number], a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

/* 무대 한 판. 바탕 안개 → 광원 → 에셋 → 비네팅 순으로 쌓고,
   맨 위에 색 보정을 통째로 건다. 순서가 바뀌면 보정이 광원만 먹는다. */
export function Stage({
  game,
  fit,
  hero,
  className = "aspect-[16/9]",
}: {
  game: SceneGame;
  fit: boolean;
  hero?: string;
  /** 무대 비율. 씬 페이지는 16:9 지만 홈에서는 첫 화면을 다 먹으면 안 된다. */
  className?: string;
}) {
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
      className={`relative overflow-hidden rounded-2xl border border-line ${className}`}
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

      {/* 첫 자리는 사용자가 고른 에셋이 선다. 여기가 바뀌지 않으면
          아래 칩을 눌러도 화면이 그대로라 무엇을 보고 있는지 알 수 없다. */}
      {game.place.map((p, i) => (
        <Placed
          key={p.key + i}
          model={(i === 0 && hero) || PLACE_MODEL[p.key]}
          x={p.x}
          y={p.y}
          s={p.s}
          r={p.r}
          fit={fit}
          game={game}
        />
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
  model,
  x,
  y,
  s,
  r,
  fit,
  game,
}: {
  model?: string;
  x: number;
  y: number;
  s: number;
  r: number;
  fit: boolean;
  game: SceneGame;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const piece = PIECES.find((p) => p.m === model);
    const url = piece && modelSrc(piece);
    if (!url) return;
    let alive = true;
    bakeView(url, [1.3, 0.85, 1.6], "pbr")
      .then((u) => alive && setSrc(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [model]);

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

