import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MARKET, MARKET_SOURCE, MODEL, CHECK_WEIGHTS, REVIEWS, AI_DEV, AI_DEV_SOURCE, REVENUE_FUNNEL, FUNNEL_RESULT } from "../data/ir";
import { PIECES } from "../data/pieces";
import { Sprite } from "../three/Sprite";
import { CONCEPTS } from "../data/concepts";
import { Donut, CheckWeights, AssetRail, ConceptGrid, CompareBars, useCountUp } from "../components/Infographic";
import { Globe } from "../components/Globe";

/* IR — 얼마나 큰 시장이고, 누가 쓰고, 어떻게 버는가.
   인용값과 우리 가정을 절대 같은 줄에 놓지 않는다. 섞이면 자료가 아니다. */

export function Ir() {
  const [used, setUsed] = useState("전체");
  /* 리뷰가 실제로 언급한 기능만 칩으로 낸다. 손으로 적어 두면 리뷰가 늘 때 어긋난다. */
  const features = useMemo(
    () => [...new Set(REVIEWS.flatMap((r) => r.used.split(",").map((x) => x.trim())))],
    [],
  );
  const shown = useMemo(
    () => (used === "전체" ? REVIEWS : REVIEWS.filter((r) => r.used.includes(used))),
    [used],
  );

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-24">
      <header className="grid gap-x-10 gap-y-6 py-12 lg:grid-cols-[184px_minmax(0,1fr)]">
        <p className="num text-xs text-faint lg:pt-1">IR</p>
        <div>
        {/* IR 은 정적 문서다. 무엇을 하는 회사인지 사실만 적는다. */}
        <h1 className="text-4xl leading-[1.2] font-bold text-ink">
          게임 에셋 검증 및 컨셉 정합 플랫폼
        </h1>
        <ol className="mt-5 grid list-none gap-x-10 gap-y-4 p-0 sm:grid-cols-3">
          {[
            ["창작자", "에셋 등록"],
            ["플랫폼", "정적 분석 7항목, 배지 부여"],
            ["게임사", "구독 접근, 에디터로 컨셉 변환"],
          ].map(([who, what], i) => (
            <li key={who}>
              <span className="num text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-xs font-bold text-ink">{who}</p>
              <p className="mt-0.5 text-xs text-faint">{what}</p>
            </li>
          ))}
        </ol>
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <IrStat k="주 수익원" v="게임사 구독" />
          <IrStat k="거래 수수료" v="8% 단일" />
          <IrStat k="창작자 정산" v="92%" />
          <IrStat k="기준일" v="2026년 7월" />
        </dl>
        </div>
      </header>

      <div className="pb-12">
        <AssetRail />
      </div>

      <Section n="01" title="검증">
        {/* 떨어지는 비율보다 통과하는 비율을 말한다. 사는 쪽이 궁금한 건 남은 쪽이다. */}
        <Donut
          percent={38.8}
          label="퀄리티 검증률"
          sub="7항목을 모두 통과한 비율. 나머지는 마켓에 오르지 않습니다."
        />
      </Section>

      <Section n="02" title="시장">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {MARKET.map((f) => (
            <div key={f.label}>
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

      <Section n="03" title="정적 분석" lead="학습 소스 역추적 채점">
        <CheckWeights items={CHECK_WEIGHTS} />
      </Section>

      <Section n="04" title="에디터" lead="컨셉별 변환 결과">
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
        <div className="mb-4 grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {AI_DEV.map((f) => (
            <CountStat key={f.label} label={f.label} value={f.value} unit={f.unit ?? ""} note={f.note} />
          ))}
        </div>
        <p className="mb-5 text-xs text-faint">출처 {AI_DEV_SOURCE}</p>

        {/* 어떤 기능 때문에 쓰는지로 걸러 본다. 수요는 숫자가 아니라 쓰임새로 드러난다. */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {["전체", ...features].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setUsed(f)}
              aria-pressed={used === f}
              className={[
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                used === f
                  ? "border-transparent bg-ink font-bold text-ground"
                  : "border-line text-muted hover:border-accent hover:text-ink",
              ].join(" ")}
            >
              {f}
              <span className={used === f ? "ml-1.5 opacity-60" : "ml-1.5 text-faint"}>
                {f === "전체" ? REVIEWS.length : REVIEWS.filter((r) => r.used.includes(f)).length}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((r, i) => (
            <figure
              key={r.initials + r.role}
              style={{ animationDelay: `${i * 45}ms` }}
              className="m-0 flex animate-[fade_.4s_both] flex-col border-t border-line pt-4"
            >
              <blockquote className="m-0 flex-1 text-xs leading-relaxed text-muted">{r.body}</blockquote>
              <figcaption className="mt-3 flex items-center gap-3">
                {/* 사진을 안 쓴다. 실명과 얼굴은 본인이 직접 줘야 하는 것이다. */}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                  {r.initials}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-xs font-semibold text-ink">{r.role}</b>
                  <span className="block truncate text-xs text-faint">
                    {r.org} {r.size} 인증
                  </span>
                </span>
              </figcaption>
              <p className="mt-2 text-xs text-faint">{r.used}</p>
            </figure>
          ))}
        </div>
        <style>{`@keyframes fade { from { opacity: 0; translate: 0 8px } to { opacity: 1; translate: 0 0 } }`}</style>

        <p className="mt-4 text-xs text-faint">
          소속만 인증하고 신원은 가립니다. 실명으로는 프로덕션에서 터진 얘기가 나오지 않습니다.
          위 문장은 시연용으로 작성한 것이며 실제 인용이 아닙니다.
        </p>
      </Section>

      <Section n="06" title="수익 모델">
        <RevenueFunnel />

        {/* 가정을 가로 한 줄로 눕힌다. 두 칸으로 나누면 왼쪽이 반쯤 빈다. */}
        <dl className="mb-8 grid gap-x-8 gap-y-5 border-b border-line pb-6 sm:grid-cols-3 lg:grid-cols-5">
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

        <div>
          <Curve />
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
            {MODEL.milestones.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-faint">{k}</dt>
                <dd className="num m-0 text-2xl text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section n="07" title="공급 지역">
        <Globe className="mx-auto aspect-square w-full max-w-[520px]" />
      </Section>

      <Section n="08" title="수수료" lead="배지와 무관">
        <div>
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

/* 모수에서 MRR 까지. 단계마다 몇이 남는지를 막대 폭으로 보여주고,
   인용값과 가정을 구분해 표시한다 — 섞으면 계산이 아니라 주장이 된다. */
function RevenueFunnel() {
  const [on, setOn] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fallback = setTimeout(() => setOn(true), 900);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0 });
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  const top = REVENUE_FUNNEL[0]?.value ?? 1;
  /* 19,606 에서 123 으로 떨어지는 구간이라 선형이면 아래 두 칸이 안 보인다. */
  const w = (v: number) => Math.max(8, (Math.log10(v) / Math.log10(top)) * 100);

  return (
    <div ref={box} className="mb-8">
      <div className="flex flex-col gap-3.5">
        {REVENUE_FUNNEL.map((s) => (
          <div key={s.label}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-ink">{s.label}</span>
              {s.rate && <span className="text-[10px] text-accent">{s.rate}</span>}
              <span className="text-[10px] text-faint">{s.note}</span>
              <span
                className={[
                  "rounded px-1.5 text-[10px]",
                  s.kind === "인용" ? "bg-surface-2 text-muted" : "border border-line text-faint",
                ].join(" ")}
              >
                {s.kind}
              </span>
              <b className="num ml-auto text-base text-ink">{s.show}</b>
            </div>
            <span
              className="mt-1.5 block h-2.5 rounded-sm bg-chrome-700 transition-[width] duration-700"
              style={{ width: on ? `${w(s.value)}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* 마지막 단계에 구독료를 곱하면 아래 마일스톤의 24개월 MRR 이 나온다. */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-4">
        <span className="num text-2xl text-ink">{FUNNEL_RESULT.seats}곳</span>
        <span className="text-xs text-faint">×</span>
        <span className="num text-2xl text-ink">{FUNNEL_RESULT.price}만원</span>
        <span className="text-xs text-faint">=</span>
        <span className="num text-4xl text-accent">{FUNNEL_RESULT.mrr}</span>
        <span className="ml-auto text-xs text-faint">연 환산 {FUNNEL_RESULT.arr}</span>
      </div>
    </div>
  );
}

/* 화면에 들어올 때 올라가는 지표. 소수점이 있으면 자릿수를 유지한다. */
function CountStat({ label, value, unit, note }: { label: string; value: string; unit: string; note: string }) {
  const digits = value.replace(/,/g, "");
  const decimals = digits.includes(".") ? digits.split(".")[1]!.length : 0;
  const [ref, shown] = useCountUp(Number(digits), decimals);
  const pretty = Number(shown).toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div className="bg-surface p-5">
      <p className="text-xs text-faint">{label}</p>
      <p className="num mt-3 text-4xl leading-none text-ink">
        <span ref={ref}>{pretty}</span>
        <span className="ml-1 text-base text-muted">{unit}</span>
      </p>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </div>
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
        "grid gap-x-10 gap-y-4 border-t border-line pt-8 pb-16 transition-all duration-700",
        "lg:grid-cols-[184px_minmax(0,1fr)]",
        on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      ].join(" ")}
    >
      <div className="lg:sticky lg:top-[120px] lg:self-start">
        <span className="num block text-xs text-faint">{n}</span>
        <h2 className="mt-1 text-2xl leading-snug font-bold text-ink">{title}</h2>
        {lead && <p className="mt-2 truncate text-xs text-muted" title={lead}>{lead}</p>}
      </div>
      <div className="min-w-0">{children}</div>
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

  const last = pts.at(-1) ?? 0;

  return (
    <div className="relative">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="24개월 MRR 추이">
        {[10, 20, 30].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={`0,40 ${d} 100,40`} fill="var(--accent-soft)" stroke="none" />
        <polyline points={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* 끝점에 값을 붙인다. 선만 있으면 어디까지 온 건지 안 보인다. */}
      <span
        className="pointer-events-none absolute right-0 -translate-y-1/2 rounded bg-accent px-2 py-0.5 text-xs font-bold text-white"
        style={{ top: `${(1 - last / max) * 90 + 5}%` }}
      >
        {last.toLocaleString("ko-KR")}만원
      </span>
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>0개월</span>
        <span>24개월</span>
      </div>
    </div>
  );
}
