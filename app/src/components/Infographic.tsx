import { useEffect, useRef, useState } from "react";
import { PIECES, modelSrc, type Piece } from "../data/pieces";
import { Thumb } from "./Thumb";
import { Sprite } from "../three/Sprite";
import { CONCEPTS, NEUTRAL_RASTER } from "../data/concepts";
import { CHECK_WEIGHTS } from "../data/ir";

/* 화면에서 제일 먼저 보이는 건 글이 아니라 그림이어야 한다.
   여기 있는 것들이 각 섹션의 본문이고, 글은 그 밑에 붙는 설명이다. */

/** 숫자가 화면에 들어올 때 올라간다. 정지한 숫자는 그냥 글자다. */
export function useCountUp(target: number, decimals = 0) {
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
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const u = Math.min(1, (t - t0) / 1100);
        setN(target * (1 - Math.pow(1 - u, 3)));
        if (u < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    /* 관찰이 안 걸리는 경우가 있다. 그때 숫자가 0 으로 남으면 지표가 아니라 오류로 보인다. */
    const fallback = setTimeout(run, 900);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && run());
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]);

  return [ref, n.toFixed(decimals)] as const;
}

/** 화면에 들어왔는가. 막대를 0 에서 늘리는 데 쓴다. 관찰이 안 걸려도 결국 켜진다. */
export function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setSeen(true);
    const fallback = setTimeout(on, 900);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && on());
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  return [ref, seen] as const;
}

/* 핵심 지표.

   색을 새로 늘리지 않고 액센트를 한 단계 밝혀 옅은 바탕 위에 올린다. 여기 붙은
   숫자는 그 블록에서 하나뿐인 결론이다. 블록마다 하나만 쓴다 — 둘이 되는
   순간 어느 쪽도 핵심이 아니게 된다.

   숫자는 화면에 들어올 때 올라간다. 정지한 숫자는 그냥 글자다. */
export function Key({
  value,
  suffix = "",
  decimals = 0,
  size = "md",
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  size?: "md" | "lg";
}) {
  const [ref, shown] = useCountUp(value, decimals);
  return (
    <span
      ref={ref}
      className={[
        "num inline-flex items-baseline text-key",
        size === "lg" ? "text-6xl leading-none" : "text-2xl",
      ].join(" ")}
    >
      {shown}
      <span className={size === "lg" ? "text-2xl" : "text-xs font-normal"}>{suffix}</span>
    </span>
  );
}

/**
 * 검증 지표. 링 하나만 두면 오른쪽이 비어 아래 섹션들과 폭이 안 맞는다.
 * 같은 3열로 채우되 셋이 한 이야기를 하게 둔다 — 얼마나 걸러지고,
 * 무엇 때문에 걸러지고, 걸러진 뒤에 어떻게 되는가.
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
    <div ref={box} className="grid gap-x-12 gap-y-8 sm:grid-cols-3">
      {/* 세 칸이 같은 뼈대를 쓴다 — 숫자, 제목, 조건. 첫 칸만 위에 링이 붙는다.
         구조가 다르면 같은 크기로 써도 다르게 읽힌다. */}
      <div>
        <svg
          viewBox="0 0 220 220"
          className="mb-3 block h-14 w-14 -rotate-90"
          role="img"
          aria-label={`${percent}% ${label}`}
        >
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="34" />
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="34"
            strokeLinecap="butt"
            strokeDasharray={C}
            strokeDashoffset={on ? C * (1 - percent / 100) : C}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        <p className="num text-4xl leading-none text-ink">
          <span ref={ref}>{shown}</span>
          <span className="text-base text-muted">%</span>
        </p>
        <p className="mt-2 text-xs font-bold text-ink">{label}</p>
        <p className="mt-1 text-xs text-faint">{sub}</p>
      </div>

      <div>
        {/* 링과 같은 자리에 다른 그림을 둔다. 여기서 할 말은 비율이 아니라
            "일곱 중 하나가 제일 무겁다" 라서 형태도 막대여야 맞다. */}
        <WeightSpark on={on} />
        <p className="num text-4xl leading-none text-ink">
          22<span className="text-base text-muted">%</span>
        </p>
        <p className="mt-2 text-xs font-bold text-ink">최고 가중치 항목</p>
        <p className="mt-1 text-xs text-faint">라이선스 출처, 60점 미만 단독 탈락</p>
      </div>

      <div>
        {/* 개수를 말하는 칸이라 낱개가 보이는 그림이 맞다. 색은 각 컨셉의
            실제 노브 값에서 뽑는다 — 임의로 칠하면 그림이 자료가 아니게 된다. */}
        <ConceptDots on={on} />
        <p className="num text-4xl leading-none text-ink">
          11<span className="text-base text-muted">종</span>
        </p>
        <p className="mt-2 text-xs font-bold text-ink">변환 컨셉</p>
        <p className="mt-1 text-xs text-faint">통과 에셋에 적용 가능, 팔레트 9종 별도</p>
      </div>
    </div>
  );
}

/** 일곱 항목의 가중치를 막대 높이로. 제일 무거운 하나만 액센트다. */
function WeightSpark({ on }: { on: boolean }) {
  const max = Math.max(...CHECK_WEIGHTS.map(([, w]) => w));
  return (
    <span
      className="mb-3 flex h-14 w-14 items-end gap-[3px]"
      role="img"
      aria-label={`가중치 최고 ${CHECK_WEIGHTS[0]?.[0]} ${max}%`}
    >
      {CHECK_WEIGHTS.map(([name, w], i) => (
        <span
          key={name}
          title={`${name} ${w}%`}
          className={[
            "min-w-0 flex-1 rounded-[1px] transition-[height] duration-700 ease-out motion-reduce:transition-none",
            i === 0 ? "bg-accent" : "bg-surface-2",
          ].join(" ")}
          style={{ height: on ? `${(w / max) * 100}%` : "6%", transitionDelay: `${i * 60}ms` }}
        />
      ))}
    </span>
  );
}

/* 컨셉 열한 개를 낱개 타일로.

   농도는 각 컨셉의 채도 노브에서 뽑는다. 색상까지 노브에서 뽑으면 열한 칸이
   무지개가 되어 이 사이트가 쓰는 색 셋을 깨뜨린다. 한 색의 농도 차이만으로도
   "열한 개가 서로 다르다" 는 말은 그대로 전달된다. */
function ConceptDots({ on }: { on: boolean }) {
  return (
    <span className="mb-3 grid h-14 w-14 grid-cols-4 gap-[3px]" role="img" aria-label="변환 컨셉 11종">
      {CONCEPTS.slice(0, 11).map((c, i) => (
        <span
          key={c.id}
          title={c.name}
          className="rounded-[2px] transition-opacity duration-500 motion-reduce:transition-none"
          style={{
            background: `color-mix(in srgb, var(--accent) ${Math.round(18 + c.knobs.sat * 0.8)}%, var(--surface-2))`,
            opacity: on ? 1 : 0,
            transitionDelay: `${i * 45}ms`,
          }}
        />
      ))}
    </span>
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
      <div className="flex h-12 w-full overflow-hidden rounded-lg border border-line">
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

      <dl className="mt-7 grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {items.map(([name, w, why], i) => (
          <div key={name} className="flex items-baseline gap-3 border-b border-line-soft pb-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: shade(i) }} />
            <dt className="shrink-0 text-xs font-semibold text-ink">{name}</dt>
            <dd className="m-0 min-w-0 flex-1 truncate text-[10px] text-faint">{why}</dd>
            <dd className="num m-0 shrink-0 text-base text-ink">{w}</dd>
          </div>
        ))}
      </dl>

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
            <div className="relative aspect-square rounded-xl border border-line bg-gradient-to-b from-surface-2 to-surface">
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
    /* 모바일에서도 2열이다. 1열로 두면 정사각형 하나가 화면을 통째로 먹어
       여덟 장을 보려고 스크롤을 2,500px 내려야 한다. 컨셉 비교는 나란히
       놓여야 성립하는데, 한 번에 하나만 보이면 비교 자체가 안 된다. */
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ids.map((id) => {
        const c = CONCEPTS.find((x) => x.id === id);
        if (!c) return null;
        return (
          <figure key={id} className="m-0">
            <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface">
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
export function CompareBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => r[1]));

  return (
    <div className="flex flex-col gap-6">
      {rows.map(([name, v], i) => (
        <div key={name}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={`text-xs ${i === 0 ? "font-bold text-ink" : "text-muted"}`}>{name}</span>
            <b className={`num text-2xl ${i === 0 ? "text-accent" : "text-ink"}`}>{v}%</b>
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
