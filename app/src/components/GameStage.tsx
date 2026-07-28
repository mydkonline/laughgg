import { useEffect, useState } from "react";

import { PLACE_MODEL, type SceneGame } from "../data/scenes";
import { SCENE_BG } from "../data/scenebg";
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
  editable = false,
}: {
  game: SceneGame;
  fit: boolean;
  hero?: string;
  /** 무대 비율. 씬 페이지는 16:9 지만 홈에서는 첫 화면을 다 먹으면 안 된다. */
  className?: string;
  /** 켜면 에셋을 끌어 옮길 수 있다. 홈 시연은 정적이라 끈다. */
  editable?: boolean;
}) {
  const { grade } = game;

  /* 배치는 게임마다 기본값이 있고, 편집 모드에서 사용자가 옮기면 그 위에
     덮어쓴다. 게임을 바꾸면 그 게임 기본값으로 되돌린다 — 앞 게임에서
     옮긴 자리가 다음 게임에 남으면 안 된다. */
  const [places, setPlaces] = useState(game.place);
  useEffect(() => setPlaces(game.place), [game]);
  const moved = places !== game.place;
  const patch = (i: number, p: Partial<(typeof places)[number]>) =>
    setPlaces((ps) => ps.map((q, j) => (j === i ? { ...q, ...p } : q)));

  /* 소유자가 올린 배경 맵. 정적 배포라 서버가 없어서 브라우저에만 담는다 —
     게임마다 따로 저장하고, 이미지는 그대로, glb/gltf 는 구워서 한 장으로.
     각 계정 소유자가 자기 게임 무대에 맞는 배경을 올린다는 가정이다. */
  const bgKey = `scenebg:${game.id}`;
  const [bgUp, setBgUp] = useState<string | null>(null);
  useEffect(() => {
    try {
      setBgUp(localStorage.getItem(bgKey));
    } catch {
      setBgUp(null);
    }
  }, [bgKey]);

  const uploadBg = async (file: File) => {
    let data: string | null = null;
    if (file.type.startsWith("image/")) {
      data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    } else if (/\.(glb|gltf)$/i.test(file.name)) {
      // 3D 환경은 무대 카메라로 넓게 한 판 굽는다 — three 뷰어를 새로 안 띄운다.
      const url = URL.createObjectURL(file);
      try {
        data = await bakeView(url, [2.2, 1, 2.6], "pbr");
      } catch {
        data = null;
      }
      URL.revokeObjectURL(url);
    }
    if (!data) return;
    setBgUp(data);
    try {
      localStorage.setItem(bgKey, data);
    } catch {
      // 저장 한도를 넘으면 이번 세션에만 남는다.
    }
  };
  const clearBg = () => {
    setBgUp(null);
    try {
      localStorage.removeItem(bgKey);
    } catch {
      /* 무시 */
    }
  };
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
      data-stage
      className={`relative overflow-hidden rounded-2xl border border-line ${className}`}
      style={{ background: rgb(game.fog), filter }}
    >
      {/* 배경. 소유자가 올린 맵이 있으면 그걸 먼저, 없으면 화풍 기본 배경.
          맨 아래에 깔아 광원·에셋이 그 위에 얹히고, 부모 색보정(filter)이
          배경에도 먹어 게임 톤으로 물든다. */}
      {bgUp ? (
        <img
          src={bgUp}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : SCENE_BG[game.sub] ? (
        <img
          src={`${import.meta.env.BASE_URL}assets/scenes/${SCENE_BG[game.sub]}.svg`}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
        />
      ) : null}

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
      {places.map((p, i) => (
        <Placed
          key={p.key + i}
          model={(i === 0 && hero) || PLACE_MODEL[p.key]}
          x={p.x}
          y={p.y}
          s={p.s}
          r={p.r}
          fit={fit}
          game={game}
          editable={editable}
          onChange={(np) => patch(i, np)}
        />
      ))}

      <span
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 ${game.vig * 160}px ${game.vig * 60}px ${rgb(game.fog, 0.9)}` }}
      />

      {/* 편집 안내·초기화. 색 보정(filter) 밖에 두려고 여기 얹지만 filter 는
          부모에 걸려 있어 톤이 살짝 먹는다 — 무대 위 UI 라 그 편이 자연스럽다. */}
      {editable && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-black/45 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
              에셋을 끌어 옮기세요
            </span>
            <label className="pointer-events-auto cursor-pointer rounded border border-white/20 bg-black/45 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm hover:bg-black/60">
              배경 맵 올리기
              <input
                type="file"
                accept="image/*,.glb,.gltf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBg(f);
                  e.target.value = "";
                }}
              />
            </label>
            {bgUp && (
              <button
                type="button"
                onClick={clearBg}
                className="pointer-events-auto cursor-pointer rounded border border-white/20 bg-black/45 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm hover:bg-black/60"
              >
                배경 제거
              </button>
            )}
          </div>
          {moved && (
            <button
              type="button"
              onClick={() => setPlaces(game.place)}
              className="pointer-events-auto cursor-pointer rounded border border-white/20 bg-black/45 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm hover:bg-black/60"
            >
              위치 초기화
            </button>
          )}
        </div>
      )}
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
  editable = false,
  onChange,
}: {
  model?: string;
  x: number;
  y: number;
  s: number;
  r: number;
  fit: boolean;
  game: SceneGame;
  editable?: boolean;
  onChange?: (p: { x?: number; y?: number; s?: number }) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  /* 끌어서 옮긴다. 무대 좌표는 비율(0~1)이라 커서 위치를 무대 폭·높이로
     나눈다. 가장자리로 아예 밀어내지 못하게 살짝 가둔다. */
  const startDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!editable || !onChange) return;
    e.preventDefault();
    const stage = (e.currentTarget.closest("[data-stage]") as HTMLElement | null)?.getBoundingClientRect();
    if (!stage) return;
    const move = (ev: PointerEvent) => {
      const nx = Math.min(0.94, Math.max(0.06, (ev.clientX - stage.left) / stage.width));
      const ny = Math.min(0.96, Math.max(0.2, (ev.clientY - stage.top) / stage.height));
      onChange({ x: nx, y: ny });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

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
      onPointerDown={startDrag}
      className={`absolute drop-shadow-[0_10px_18px_rgb(0_0_0/0.5)] transition-[filter] duration-500 ${
        editable ? "cursor-grab touch-none select-none active:cursor-grabbing" : "pointer-events-none"
      }`}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        height: `${s * 46}%`,
        translate: "-50% -70%",
        rotate: `${r * 0.4}deg`,
        filter: tint,
      }}
      draggable={false}
    />
  );
}

