import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MARKET, REACH, MODEL, CHECK_WEIGHTS } from "../data/ir";
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
        <p className="mt-4 max-w-[52ch] text-base text-muted">
          AI 가 생성을 흔하게 만들수록 희소해지는 건 만드는 능력이 아니라 쓸 만한지 보증하는 능력입니다.
          그 보증을 팔고, 사는 쪽 게임 컨셉에 맞춰 내보냅니다.
        </p>
      </header>

      <Section n="01" title="시장" lead="인용값만 씁니다. 출처를 각 항목에 붙였습니다.">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {MARKET.map((f) => (
            <div key={f.label} className="bg-surface p-6">
              <p className="text-xs text-faint">{f.label}</p>
              <p className="mt-2 text-6xl leading-none font-bold tabular-nums text-ink">
                {f.value}
                <span className="ml-1 text-2xl font-semibold text-muted">{f.unit}</span>
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted">{f.note}</p>
              <p className="mt-2 text-xs text-faint">{f.source}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        n="02"
        title="검수"
        lead="7항목을 가중 합산합니다. 라이선스 출처가 60 미만이면 다른 점수와 무관하게 탈락입니다."
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
        lead="검수만으로는 사는 쪽이 바로 못 씁니다. 같은 에셋을 게임 컨셉에 맞춰 내보냅니다."
      >
        <ConceptStrip />
      </Section>

      <Section
        n="04"
        title="수요"
        lead="OP.GG 를 참조하는 개발자가 몇 명인가. 인용값이 아니라 우리 계산이며, 계산 과정을 그대로 냅니다."
      >
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-xl border border-line bg-surface p-6">
            <p className="text-xs text-faint">{REACH.headline.label}</p>
            <p className="mt-2 text-6xl leading-none font-bold tabular-nums text-ink">
              {REACH.headline.value}
              <span className="ml-1 text-2xl font-semibold text-muted">{REACH.headline.unit}</span>
            </p>
            <p className="mt-3 text-base text-muted">범위 {REACH.band}</p>
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
              <div key={w.way} className="rounded-xl border border-line bg-surface p-5">
                <p className="text-base font-bold text-ink">{w.way}</p>
                <ol className="mt-4 flex list-none flex-col gap-3 p-0">
                  {w.steps.map(([k, v], i) => (
                    <li key={k} className="flex items-baseline justify-between gap-3 text-base">
                      <span className="text-muted">
                        <b className="mr-2 text-xs tabular-nums text-faint">{i + 1}</b>
                        {k}
                      </span>
                      <b className="shrink-0 tabular-nums text-ink">{v}</b>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 border-t border-line pt-3 text-base">
                  <span className="text-faint">결과 </span>
                  <b className="tabular-nums text-accent">{w.result}</b>
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">{REACH.overlap}</p>
      </Section>

      <Section n="05" title="수익 모델" lead="가정을 먼저 적습니다. 고정비와 이탈률 없이는 검증할 수 없습니다.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-base font-bold text-ink">가정</p>
            <dl className="flex flex-col gap-2.5">
              {MODEL.assumptions.map(([k, v, note]) => (
                <div key={k} className="grid grid-cols-[112px_minmax(0,1fr)] items-baseline gap-3">
                  <dt className="text-xs text-faint">{k}</dt>
                  <dd className="m-0 flex flex-wrap items-baseline gap-2">
                    <b className="text-base tabular-nums text-ink">{v}</b>
                    <span className="text-xs text-faint">{note}</span>
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

      <Section n="06" title="수수료" lead="배지에 연동하지 않습니다. 배지는 값이 아니라 노출 순위를 정합니다.">
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
        <p className="mt-4 text-base text-muted">
          창작자가 판매액의 92% 를 가져갑니다. 창작자는 공급이지 수익원이 아니라고 봅니다.
        </p>
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

function Section({ n, title, lead, children }: { n: string; title: string; lead: string; children: React.ReactNode }) {
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
        <p className="max-w-[58ch] text-base text-muted">{lead}</p>
      </div>
      {children}
    </section>
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
