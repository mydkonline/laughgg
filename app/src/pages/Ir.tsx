import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MARKET, MARKET_SOURCE, REACH, MODEL, CHECK_WEIGHTS } from "../data/ir";
import { PIECES, modelSrc } from "../data/pieces";
import { Preview } from "../three/Preview";
import { Sprite } from "../three/Sprite";
import { CONCEPTS } from "../data/concepts";

/* IR — 얼마나 큰 시장이고, 누가 쓰고, 어떻게 버는가.
   인용값과 우리 가정을 절대 같은 줄에 놓지 않는다. 섞이면 자료가 아니다. */

export function Ir() {
  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-24">
      <header className="py-10">
        <p className="text-xs tracking-wide text-accent">IR</p>
        <h1 className="mt-1 max-w-[20ch] text-6xl leading-[1.1] font-bold text-ink">
          에셋을 만들지 않고 배지를 만듭니다
        </h1>
        <p className="mt-4 max-w-[44ch] text-base text-muted">
          생성이 흔해질수록 희소해지는 건 보증입니다. 보증을 팔고, 사는 쪽 컨셉에 맞춰 내보냅니다.
        </p>
      </header>

      <Section n="01" title="시장">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {MARKET.map((f) => (
            <div key={f.label} className="bg-surface p-6">
              <p className="text-xs text-faint">{f.label}</p>
              <p className="mt-3 text-6xl leading-none font-bold tabular-nums text-ink">
                {f.value}
                <span className="ml-1 text-2xl font-semibold text-muted">{f.unit}</span>
              </p>
              <p className="mt-3 text-xs text-muted">{f.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">출처 {MARKET_SOURCE}</p>
      </Section>

      <Section
        n="02"
        title="검수"
        lead="라이선스 출처가 60 미만이면 무조건 탈락"
      >
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-col gap-3">
            {CHECK_WEIGHTS.map(([name, w, why]) => (
              <div key={name} className="grid grid-cols-[132px_minmax(0,1fr)_34px] items-center gap-4">
                <span className="truncate text-base font-semibold text-ink">{name}</span>
                <span className="flex items-center gap-3">
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <b className="block h-full bg-accent" style={{ width: `${(w / 22) * 100}%` }} />
                  </span>
                  <span className="hidden shrink-0 text-xs text-faint sm:block">{why}</span>
                </span>
                <span className="text-right text-base tabular-nums text-muted">{w}%</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        n="03"
        title="맞추기"
        lead="같은 에셋, 다른 게임 컨셉"
      >
        <ConceptStrip />
      </Section>

      <Section
        n="04"
        title="수요"
        lead="인용값 아님. 우리 계산이고 과정을 냅니다"
      >
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-xl border border-line bg-surface p-6">
            <p className="text-xs text-faint">{REACH.headline.label}</p>
            <p className="mt-2 text-6xl leading-none font-bold tabular-nums text-ink">
              {REACH.headline.value}
              <span className="ml-1 text-2xl font-semibold text-muted">{REACH.headline.unit}</span>
            </p>
            <p className="mt-3 text-xs text-muted">범위 {REACH.band}</p>
            <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
              {REACH.derived.map(([k, v, note]) => (
                <div key={k}>
                  <dt className="text-xs text-faint">{k}</dt>
                  <dd className="m-0 text-2xl font-bold tabular-nums text-ink">{v}</dd>
                  <dd className="m-0 text-xs text-faint">{note}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {REACH.ways.map((w) => (
              <Funnel key={w.way} way={w} />
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs text-faint">{REACH.overlap}</p>
      </Section>

      <Section n="05" title="수익 모델" lead="가정을 먼저">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-base font-bold text-ink">가정</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {MODEL.assumptions.map(([k, v, unit]) => (
                <div key={k}>
                  <dt className="text-xs text-faint">{k}</dt>
                  <dd className="m-0 text-2xl font-bold tabular-nums text-ink">
                    {v}
                    <span className="ml-1 text-xs font-normal text-faint">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-base font-bold text-ink">결과</p>
            <Curve />
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
              {MODEL.milestones.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-faint">{k}</dt>
                  <dd className="m-0 text-2xl font-bold tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section n="06" title="수수료" lead="배지에 연동하지 않습니다">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {[
            ["LaughGG", "8%", "단일"],
            ["Epic Fab", "12%", "인용"],
            ["Unity Asset Store", "30%", "인용"],
          ].map(([who, rate, tag], i) => (
            <div key={who} className="bg-surface p-6">
              <p className="text-xs text-faint">{who}</p>
              <p className={`mt-2 text-6xl leading-none font-bold tabular-nums ${i === 0 ? "text-accent" : "text-ink"}`}>
                {rate}
              </p>
              <p className="mt-2 text-xs text-faint">{tag}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">창작자가 92% 를 가져갑니다.</p>
      </Section>

      <div className="mt-16 flex flex-wrap gap-3 border-t border-line pt-8">
        <Link
          to="/workshop"
          className="rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-white no-underline hover:bg-accent-strong"
        >
          공방 열기
        </Link>
        <Link
          to="/market"
          className="rounded-xl border border-line px-6 py-3.5 text-base font-semibold text-muted no-underline hover:border-accent hover:text-ink"
        >
          마켓 둘러보기
        </Link>
      </div>
    </main>
  );
}

function Section({ n, title, lead, children }: { n: string; title: string; lead?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={[
        "border-t border-line pt-8 pb-14 transition-all duration-700",
        on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      ].join(" ")}
    >
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-xs tabular-nums text-faint">{n}</span>
        <h2 className="text-4xl font-bold text-ink">{title}</h2>
        {lead && <p className="text-xs text-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/* 퍼널 — 단계마다 몇 명이 남는지를 막대 폭으로 보여준다.
   숫자 세 줄을 글로 늘어놓으면 아무도 안 읽는다. */
function Funnel({ way }: { way: (typeof REACH.ways)[number] }) {
  const top = way.steps[0]?.value ?? 1;
  /* 2,500만에서 16만으로 떨어지는 구간이라 선형으로 그리면 아래 두 칸이 안 보인다.
     로그로 눕혀야 단계가 눈에 남는다. */
  const w = (v: number) => `${Math.max(6, (Math.log10(v) / Math.log10(top)) * 100)}%`;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs text-faint">{way.way}</p>
      <div className="mt-4 flex flex-col gap-3">
        {way.steps.map((s, i) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted">
                {s.label}
                {s.rate && <span className="ml-1.5 text-faint">{s.rate}</span>}
              </span>
              <b className="shrink-0 text-base tabular-nums text-ink">{s.show}</b>
            </div>
            <span
              className={`mt-1 block h-2 rounded-sm ${i === way.steps.length - 1 ? "bg-accent" : "bg-chrome-700"}`}
              style={{ width: w(s.value) }}
            />
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs">
        <span className="text-faint">결과 </span>
        <b className="text-base tabular-nums text-accent">{way.result}</b>
      </p>
    </div>
  );
}

/* 같은 에셋이 컨셉에 따라 어떻게 달라지는지. 글로 설명하면 안 읽힌다. */
function ConceptStrip() {
  const piece = PIECES.find((p) => p.m === "kite_shield") ?? PIECES[0]!;
  const src = modelSrc(piece);
  /* 3D 두 컷과 2D 두 컷을 섞는다. 3D 끼리만 놓으면 톤 차이가 미묘해서
     "같은 에셋이 이만큼 달라진다" 가 안 읽힌다. */
  const show: [string, boolean][] = [
    ["real", false],
    ["dark", false],
    ["gb", true],
    ["pico", true],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {show.map(([id, asSprite]) => {
        const c = CONCEPTS.find((x) => x.id === id);
        if (!c || !src) return null;
        return (
          <figure key={id} className="m-0">
            <div className="aspect-square overflow-hidden rounded-xl border border-line bg-gradient-to-b from-surface-2 to-surface">
              {asSprite ? (
                <Sprite piece={piece} knobs={c.knobs} raster={c.raster} />
              ) : (
                <Preview model={src} knobs={c.knobs} spin={false} className="h-full w-full" />
              )}
            </div>
            <figcaption className="pt-2 text-xs text-faint">
              {c.name} <span className="text-faint">{asSprite ? "2D" : "3D"}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* MRR 곡선. 축 눈금 없이 모양만 보여준다 — 자릿수는 아래 표에 있다. */
function Curve() {
  const pts = MODEL.curve;
  const max = Math.max(...pts);
  const d = pts
    .map((v, i) => `${(i / (pts.length - 1)) * 100},${40 - (v / max) * 36}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="24개월 MRR 추이">
      <polyline points={`0,40 ${d} 100,40`} fill="var(--accent-soft)" stroke="none" />
      <polyline points={d} fill="none" stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
