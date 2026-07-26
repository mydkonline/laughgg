import { useEffect, useRef, useState } from "react";
import { PIECES, modelSrc, type Piece } from "../data/pieces";
import { Thumb } from "./Thumb";
import { Sprite } from "../three/Sprite";
import { CONCEPTS, NEUTRAL_RASTER } from "../data/concepts";

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
    const fallback = setTimeout(() => setOn(true), 1000);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0 });
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="flex flex-wrap items-center gap-10">
      <svg viewBox="0 0 220 220" className="h-44 w-44 shrink-0 -rotate-90" role="img" aria-label={`${percent}% ${label}`}>
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
        <p className="num text-6xl leading-none text-ink">
          <span ref={ref}>{shown}</span>
          <span className="text-2xl text-muted">%</span>
        </p>
        <p className="mt-4 text-base font-bold text-ink">{label}</p>
        <p className="mt-1 text-xs text-faint">{sub}</p>
      </div>
    </div>
  );
}

/**
 * 검수 가중치. 합이 100 이므로 누적 막대 하나로 비율을 한 번에 보여준다.
 * 항목마다 카드를 만들면 일곱 장이 되고, 비율은 오히려 안 보인다.
 */
export function CheckWeights({ items }: { items: [string, number, string][] }) {
  const [on, setOn] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fallback = setTimeout(() => setOn(true), 1000);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0 });
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  /* 라이선스만 액센트로 둔다. 유일하게 단독 탈락 사유라 다른 항목과 성격이 다르다. */
  const shade = (i: number) => (i === 0 ? "var(--accent)" : `color-mix(in srgb, var(--accent) ${34 - i * 4}%, var(--surface-2))`);

  return (
    <div ref={box}>
      <div className="flex h-14 w-full overflow-hidden rounded-lg border border-line">
        {items.map(([name, w], i) => (
          <span
            key={name}
            title={`${name} ${w}%`}
            className="grid place-items-center transition-[flex-grow] duration-700"
            style={{ flexGrow: on ? w : 0, background: shade(i) }}
          >
            {w >= 12 && <b className="num text-xs text-ground/90 mix-blend-luminosity">{w}</b>}
          </span>
        ))}
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {items.map(([name, w, why], i) => (
          <div key={name} className="flex items-baseline gap-3 border-b border-line-soft pb-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: shade(i) }} />
            <dt className="shrink-0 text-xs font-semibold text-ink">{name}</dt>
            <dd className="m-0 min-w-0 flex-1 truncate text-xs text-faint">{why}</dd>
            <dd className="num m-0 shrink-0 text-base text-ink">{w}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-xs text-ink">
        라이선스 출처 <b className="num text-base">60</b> 미만이면 다른 점수와 무관하게 탈락합니다.
      </p>
    </div>
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
  if (!modelSrc(target)) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ids.map((id) => {
        const c = CONCEPTS.find((x) => x.id === id);
        if (!c) return null;
        return (
          <figure key={id} className="m-0">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface">
              <Sprite piece={target} knobs={c.knobs} raster={NEUTRAL_RASTER} />
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
            <span className={`text-xs ${i === 0 ? "font-bold text-ink" : "text-muted"}`}>{name}</span>
            <span className="flex items-baseline gap-2">
              <b className={`num text-2xl ${i === 0 ? "text-accent" : "text-ink"}`}>{v}%</b>
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
