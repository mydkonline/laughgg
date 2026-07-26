import { useEffect, useRef, useState } from "react";
import { PIECES, modelSrc, type Piece } from "../data/pieces";
import { Thumb } from "./Thumb";
import { Preview } from "../three/Preview";
import { CONCEPTS } from "../data/concepts";

/* 화면에서 제일 먼저 보이는 건 글이 아니라 그림이어야 한다.
   여기 있는 것들이 각 섹션의 본문이고, 글은 그 밑에 붙는 설명이다. */

/** 숫자가 화면에 들어올 때 올라간다. 정지한 숫자는 그냥 글자다. */
function useCountUp(target: number, decimals = 0) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const u = Math.min(1, (t - t0) / 1100);
        setN(target * (1 - Math.pow(1 - u, 3)));
        if (u < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return [ref, n.toFixed(decimals)] as const;
}

/**
 * 탈락률 링. 이 제품이 파는 게 통과가 아니라 탈락이라는 걸 숫자 하나로 말한다.
 * 도넛은 조각이 둘일 때만 읽힌다. 셋 넘어가면 막대가 낫다.
 */
export function Donut({ percent, label, sub }: { percent: number; label: string; sub: string }) {
  const [ref, shown] = useCountUp(percent, 1);
  const R = 88;
  const C = 2 * Math.PI * R;
  const [on, setOn] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="flex flex-wrap items-center gap-10">
      <svg viewBox="0 0 220 220" className="h-56 w-56 shrink-0 -rotate-90" role="img" aria-label={`${percent}% ${label}`}>
        <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="22" />
        <circle
          cx="110"
          cy="110"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="22"
          strokeLinecap="butt"
          strokeDasharray={C}
          strokeDashoffset={on ? C * (1 - percent / 100) : C}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>

      <div>
        <p className="text-[80px] leading-none font-bold tabular-nums text-ink">
          <span ref={ref}>{shown}</span>
          <span className="text-4xl text-muted">%</span>
        </p>
        <p className="mt-3 text-2xl font-bold text-ink">{label}</p>
        <p className="mt-1 text-xs text-faint">{sub}</p>
      </div>
    </div>
  );
}

/**
 * 검수 항목 계단. 좌우로 엇갈려 내려가면서 항목마다 실제 모델을 건다.
 * 표로 만들면 일곱 줄짜리 목록이고, 계단으로 두면 훑는 동안 눈이 안 쉰다.
 */
export function CheckStair({ items }: { items: [string, number, string][] }) {
  const models = PIECES.filter((p) => p.m).slice(0, items.length);

  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {items.map(([name, weight, why], i) => {
        const piece = models[i % models.length];
        const right = i % 2 === 1;
        return (
          <li
            key={name}
            className={[
              "flex items-center gap-5 rounded-2xl border border-line bg-surface p-3",
              right ? "flex-row-reverse text-right lg:ml-[22%]" : "lg:mr-[22%]",
            ].join(" ")}
          >
            <div className="aspect-square w-24 shrink-0 rounded-xl bg-gradient-to-b from-surface-2 to-surface p-1.5">
              {piece && <Thumb piece={piece} />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-4xl leading-none font-bold tabular-nums text-ink">
                {weight}
                <span className="text-base text-muted">%</span>
              </p>
              <p className="mt-1.5 text-2xl font-bold text-ink">{name}</p>
              <p className="mt-1 text-xs text-faint">{why}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** 실제 상품이 흐르는 띠. 무엇을 파는 곳인지 한 줄로 보여준다. */
export function AssetRail() {
  const items = PIECES.filter((p) => p.m).slice(0, 12);
  const loop = [...items, ...items];

  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max gap-4 motion-safe:animate-[rail_46s_linear_infinite]">
        {loop.map((p, i) => (
          <figure key={`${p.id}-${i}`} className="m-0 w-40 shrink-0">
            <div className="aspect-square rounded-xl border border-line bg-gradient-to-b from-surface-2 to-surface p-3">
              <Thumb piece={p} />
            </div>
            <figcaption className="truncate pt-2 text-xs text-faint">{p.t}</figcaption>
          </figure>
        ))}
      </div>
      <style>{`@keyframes rail { to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

/** 같은 에셋을 컨셉만 바꿔 나란히. 글로 쓰면 안 읽히는 것을 그림으로 말한다. */
export function ConceptGrid({ piece, ids }: { piece?: Piece; ids: string[] }) {
  const target = piece ?? PIECES.find((p) => p.m === "kite_shield") ?? PIECES[0]!;
  const src = modelSrc(target);
  if (!src) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ids.map((id) => {
        const c = CONCEPTS.find((x) => x.id === id);
        if (!c) return null;
        return (
          <figure key={id} className="m-0">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface">
              <Preview model={src} knobs={c.knobs} spin={false} className="h-full w-full" />
            </div>
            <figcaption className="pt-2 text-xs text-faint">{c.name}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** 비교 막대. 숫자 셋을 나란히 놓을 때 표보다 빠르다. */
export function CompareBars({ rows }: { rows: [string, number, string][] }) {
  const max = Math.max(...rows.map((r) => r[1]));

  return (
    <div className="flex flex-col gap-5">
      {rows.map(([name, v, tag], i) => (
        <div key={name}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={`text-base ${i === 0 ? "font-bold text-ink" : "text-muted"}`}>{name}</span>
            <span className="flex items-baseline gap-2">
              <b className={`text-4xl font-bold tabular-nums ${i === 0 ? "text-accent" : "text-ink"}`}>{v}%</b>
              <span className="text-xs text-faint">{tag}</span>
            </span>
          </div>
          <span className="mt-2 block h-3 overflow-hidden rounded-sm bg-surface-2">
            <b
              className={`block h-full ${i === 0 ? "bg-accent" : "bg-chrome-700"}`}
              style={{ width: `${(v / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
