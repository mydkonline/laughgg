import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MARKET, MARKET_SOURCE, MODEL, CHECK_WEIGHTS, REVIEWS, AI_DEV, AI_DEV_SOURCE } from "../data/ir";
import { PIECES } from "../data/pieces";
import { Sprite } from "../three/Sprite";
import { CONCEPTS } from "../data/concepts";
import { Donut, CheckWeights, AssetRail, ConceptGrid, CompareBars } from "../components/Infographic";

/* IR — 얼마나 큰 시장이고, 누가 쓰고, 어떻게 버는가.
   인용값과 우리 가정을 절대 같은 줄에 놓지 않는다. 섞이면 자료가 아니다. */

export function Ir() {
  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-24">
      <header className="py-10">
        <p className="text-xs tracking-wide text-accent">IR</p>
        {/* IR 은 정적 문서다. 무엇을 하는 회사인지 사실만 적는다. */}
        <h1 className="mt-1 text-4xl leading-[1.2] font-bold text-ink">
          게임 에셋 검증 및 컨셉 정합 플랫폼
        </h1>
        <p className="mt-3 max-w-[64ch] text-xs text-muted">
          창작자가 올린 에셋을 7항목으로 정적 분석해 배지를 부여하고, 게임사가 구독으로 카탈로그에
          접근합니다. 구매한 에셋은 에디터에서 게임 컨셉에 맞춰 변환해 내려받습니다.
        </p>
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <IrStat k="주 수익원" v="게임사 구독" />
          <IrStat k="거래 수수료" v="8% 단일" />
          <IrStat k="창작자 정산" v="92%" />
          <IrStat k="기준일" v="2026년 7월" />
        </dl>
      </header>

      <div className="pb-10">
        <AssetRail />
      </div>

      <Section n="01" title="검증">
        {/* 떨어지는 비율보다 통과하는 비율을 말한다. 사는 쪽이 궁금한 건 남은 쪽이다. */}
        <Donut
          percent={38.8}
          label="퀄리티 검증률"
          sub="올라온 에셋 중 7항목을 모두 통과한 비율입니다. 나머지는 마켓에 오르지 않습니다."
        />
      </Section>

      <Section n="02" title="시장">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {MARKET.map((f) => (
            <div key={f.label} className="bg-surface p-6">
              <p className="text-xs text-faint">{f.label}</p>
              <p className="num mt-4 text-4xl leading-none text-ink">
                {f.value}
                <span className="ml-1 text-base text-muted">{f.unit}</span>
              </p>
              <p className="mt-3 text-xs text-muted">{f.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">출처 {MARKET_SOURCE}</p>
      </Section>

      <Section n="03" title="정적 분석" lead="라이선스 출처가 60 미만이면 무조건 탈락">
        <CheckWeights items={CHECK_WEIGHTS} />
      </Section>

      <Section n="04" title="에디터" lead="같은 에셋, 다른 게임 컨셉">
        <ConceptGrid ids={["real", "dark", "high", "toon"]} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["gb", "pico", "one", "sepia"].map((id) => {
            const c = CONCEPTS.find((x) => x.id === id);
            const piece = PIECES.find((p) => p.m === "kite_shield");
            if (!c || !piece) return null;
            return (
              <figure key={id} className="m-0">
                <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface">
                  <Sprite piece={piece} knobs={c.knobs} raster={c.raster} />
                </div>
                <figcaption className="pt-2 text-xs text-faint">
                  {c.name} <span className="text-faint">2D</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </Section>

      <Section n="05" title="수요">
        {/* 추정치는 한 줄로 접어 두고 실제로 쓴 사람의 말을 본문에 세운다.
            숫자는 시장이 있다는 말이고, 리뷰는 그 시장이 이걸 쓴다는 말이다. */}
        <div className="mb-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {AI_DEV.map((f) => (
            <div key={f.label} className="bg-surface p-5">
              <p className="text-xs text-faint">{f.label}</p>
              <p className="num mt-3 text-4xl leading-none text-ink">
                {f.value}
                <span className="ml-1 text-base text-muted">{f.unit}</span>
              </p>
              <p className="mt-2 text-xs text-muted">{f.note}</p>
            </div>
          ))}
        </div>
        <p className="mb-6 text-xs text-faint">출처 {AI_DEV_SOURCE}</p>


        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure key={r.initials + r.role} className="m-0 flex flex-col rounded-2xl border border-line bg-surface p-5">
              <blockquote className="m-0 flex-1 text-xs leading-relaxed text-muted">{r.body}</blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                {/* 사진을 안 쓴다. 실명과 얼굴은 본인이 직접 줘야 하는 것이다. */}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {r.initials}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-xs font-semibold text-ink">{r.role}</b>
                  <span className="block truncate text-xs text-faint">
                    {r.org} {r.size} 인증
                  </span>
                </span>
              </figcaption>
              <p className="mt-3 w-fit rounded border border-line px-2 py-1 text-xs text-faint">{r.used}</p>
            </figure>
          ))}
        </div>

        <p className="mt-4 text-xs text-faint">
          소속만 인증하고 신원은 가립니다. 실명으로는 프로덕션에서 터진 얘기가 나오지 않습니다.
          위 문장은 시연용으로 작성한 것이며 실제 인용이 아닙니다.
        </p>
      </Section>

      <Section n="06" title="수익 모델" lead="가정을 먼저">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-base font-bold text-ink">가정</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {MODEL.assumptions.map(([k, v, unit]) => (
                <div key={k}>
                  <dt className="text-xs text-faint">{k}</dt>
                  <dd className="num m-0 text-2xl text-ink">
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
                  <dd className="num m-0 text-2xl text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section n="07" title="수수료" lead="배지에 연동하지 않습니다">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <CompareBars
            rows={[
              ["LaughGG", 8],
              ["Epic Fab", 12],
              ["Unity Asset Store", 30],
            ]}
          />
        </div>
      </Section>

      <div className="mt-16 flex flex-wrap gap-3 border-t border-line pt-8">
        <Link
          to="/workshop"
          className="rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-white no-underline hover:bg-accent-strong"
        >
          스튜디오 열기
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

function IrStat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 text-xs font-semibold text-ink">{v}</dd>
    </div>
  );
}

function Section({ n, title, lead, children }: { n: string; title: string; lead?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* 관찰이 안 걸리는 경우가 있다 — 화면 밖에서 렌더되거나 뷰포트가 통째로 크거나.
       그때 내용이 영영 투명하게 남으면 안 되므로 안전망을 둔다. */
    const fallback = setTimeout(() => setOn(true), 1200);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setOn(true);
        io.disconnect();
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
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
        <h2 className="text-2xl font-bold text-ink">{title}</h2>
        {lead && <p className="text-xs text-muted">{lead}</p>}
      </div>
      {children}
    </section>
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
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="24개월 MRR 추이">
      <polyline points={`0,40 ${d} 100,40`} fill="var(--accent-soft)" stroke="none" />
      <polyline points={d} fill="none" stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
