import { useEffect, useMemo, useRef, useState } from "react";
import { MARKET, MARKET_SOURCE, MODEL, CHECK_WEIGHTS, REVIEWS, AI_DEV, AI_DEV_SOURCE, REVENUE_FUNNEL, FUNNEL_RESULT, STREAMS, STREAM_TOTAL, UNIT, RETENTION, VALUATION, SCENARIOS, ROLLOUT, ROLLOUT_SOURCE, UPSIDE, UPSIDE_NOTE } from "../data/ir";
import { PIECES } from "../data/pieces";
import { Sprite } from "../three/Sprite";
import { CONCEPTS } from "../data/concepts";
import { Donut, CheckWeights, AssetRail, ConceptGrid, CompareBars, useCountUp, useSeen, Key } from "../components/Infographic";
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
        {/* 요약. IR 은 결론부터 읽는 사람이 많아 머리말 바로 아래 둔다.
            값은 전부 본문에서 가져오므로 따로 관리하지 않는다. */}
        </div>

        {/* 요약. IR 레일 바로 아래 붙어야 문서의 첫 단락으로 읽힌다. */}
        <h2 className="mt-6 text-2xl leading-snug font-bold text-ink">요약</h2>
        {/* 넷 중 합계 MRR 하나만 강조한다. 이 문서를 여는 사람이
            제일 먼저 찾는 숫자라 나머지 셋은 그 옆에 서 있는 값이 된다. */}
        <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["퀄리티 검증률", "38.8%", "7항목 모두 통과", false],
            ["합계 MRR", `${STREAM_TOTAL.mrr.toLocaleString("ko-KR")}만원`, "구독 95%", true],
            ["누적 손익분기", "13개월", "고정비 월 1,700만원", false],
            ["거래 수수료", "8%", "Epic 12%, Unity 30%", false],
          ].map(([k, v, note, key]) => (
            <div
              key={k as string}
              className={[
                "-mx-3 rounded-lg px-3 py-2 transition-colors",
                key ? "bg-key-soft" : "hover:bg-surface",
              ].join(" ")}
            >
              <dt className={`text-xs ${key ? "font-bold text-key" : "text-faint"}`}>{k as string}</dt>
              <dd className="m-0 mt-1">
                {key ? (
                  <span className="num inline-flex items-baseline text-4xl leading-none text-key">
                    <SummaryMrr />
                    <span className="text-base font-normal">만원</span>
                  </span>
                ) : (
                  <span className="num text-4xl leading-none text-ink">{v as string}</span>
                )}
              </dd>
              <dd className="m-0 mt-1.5 text-xs text-faint">{note as string}</dd>
            </div>
          ))}
        </dl>

        <span aria-hidden="true" />
        <ol className="mt-10 grid list-none border-t border-line pt-8 lg:mt-12 gap-x-12 gap-y-6 p-0 sm:grid-cols-3">
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
      </header>

      <div className="pb-12">
        <AssetRail />
      </div>

      <Section n="01" title="검증">
        {/* 떨어지는 비율보다 통과하는 비율을 말한다. 사는 쪽이 궁금한 건 남은 쪽이다. */}
        <Donut
          percent={38.8}
          label="퀄리티 검증률"
          sub="7항목 가중 합산 70점 이상"
        />
      </Section>

      <Section n="02" title="시장">
        <div className="grid gap-x-12 gap-y-8 sm:grid-cols-3">
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
      </Section>

      {/* 정적 분석과 에디터는 따로 팔지 않는다. 걸러 낸 에셋을 그 자리에서
          컨셉에 맞추는 한 흐름이라, 섹션을 나누면 두 제품처럼 읽힌다.
          안에서만 들어오는 것과 나가는 것으로 가른다. */}
      <Section n="03" title="기술">
        <div className="flex flex-col gap-12">
          <div>
            <p className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3">
              <b className="text-base font-bold text-ink">정적 분석</b>
              <span className="text-xs text-faint">학습 소스 역추적 채점, 7항목 가중 합산</span>
            </p>
            <CheckWeights items={CHECK_WEIGHTS} />
          </div>

          <div>
            <p className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3">
              <b className="text-base font-bold text-ink">에디터</b>
              <span className="text-xs text-faint">통과한 에셋을 게임 컨셉으로 변환</span>
            </p>
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
          </div>
        </div>
      </Section>

      <Section n="04" title="수요">
        {/* 추정치는 한 줄로 접어 두고 실제로 쓴 사람의 말을 본문에 세운다.
            숫자는 시장이 있다는 말이고, 리뷰는 그 시장이 이걸 쓴다는 말이다. */}
        <div className="mb-6 grid gap-x-12 gap-y-8 sm:grid-cols-3">
          {AI_DEV.map((f) => (
            <CountStat key={f.label} label={f.label} value={f.value} unit={f.unit ?? ""} note={f.note} />
          ))}
        </div>
        <div className="mb-5" />

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

        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
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
            </figure>
          ))}
        </div>
        <style>{`@keyframes fade { from { opacity: 0; translate: 0 8px } to { opacity: 1; translate: 0 0 } }`}</style>
      </Section>

      <Section n="05" title="수익 모델">
        <Streams />
        <RevenueFunnel />

        {/* 가정을 가로 한 줄로 눕힌다. 두 칸으로 나누면 왼쪽이 반쯤 빈다. */}
        <dl className="mb-10 grid gap-x-10 gap-y-7 border-b border-line pb-8 sm:grid-cols-3 lg:grid-cols-5">
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
          <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
            {MODEL.milestones.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-faint">{k}</dt>
                <dd className="num m-0 text-2xl text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section n="06" title="기업가치" lead="sBG 잔존 + DCF, 몬테카를로 3,000회">
        <Valuation />
      </Section>

      <Section n="07" title="공급 지역" lead="공급 먼저, 수요 나중">
        <Rollout />
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

      {/* 반영하지 않은 값이라 맨 뒤에 온다. 앞에 두면 앞의 숫자들이
          이것까지 포함한 값으로 읽힌다. */}
      <Section n="09" title="기대효과" lead="밸류에이션 미반영">
        <Upside />
      </Section>

      {/* 부록. 출처를 본문에 흩어 두면 숫자마다 각주가 붙어 읽기가 끊긴다.
          검증할 사람은 여기 한 번만 오면 된다. */}
      <section className="grid gap-x-12 gap-y-6 border-t border-line pt-12 pb-16 lg:grid-cols-[184px_minmax(0,1fr)]">
        <div>
          <span className="num block text-xs text-faint">부록</span>
          <h2 className="mt-1 text-2xl leading-snug font-bold text-ink">출처</h2>
        </div>

        <dl className="min-w-0 lg:pr-8">
          {[
            ["시장", MARKET_SOURCE],
            ["수요", AI_DEV_SOURCE],
            ["수익 모델", REVENUE_FUNNEL.map((f) => `${f.label} ${f.note}`).join(" · ")],
            ["공급 지역", ROLLOUT_SOURCE],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-b border-line py-3">
              <dt className="text-xs font-semibold text-ink">{k}</dt>
              <dd className="m-0 text-xs leading-relaxed text-faint">{v}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-b border-line py-3">
            <dt className="text-xs font-semibold text-ink">표기</dt>
            <dd className="m-0 text-xs leading-relaxed text-faint">
              인용은 출처가 있는 값이고, 가정은 우리가 세운 값입니다. 수익 모델 퍼널의 앞 세 단계가
              인용이고 뒤 두 단계가 가정입니다.
            </dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 py-3">
            <dt className="text-xs font-semibold text-ink">리뷰</dt>
            <dd className="m-0 text-xs leading-relaxed text-faint">
              소속만 인증하고 신원은 가립니다. 본문 인용구는 시연용으로 작성한 것이며 실제 인용이 아닙니다.
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

/* 진출 순서.

   지구 하나만 두면 "여기저기 있습니다" 밖에 안 된다. 순서를 옆에 붙여야
   그게 계획이 된다. 단계를 짚으면 지구에서 그 지역만 남아, 어느 대륙에
   무엇을 하러 가는지가 글이 아니라 위치로 보인다. */
function Rollout() {
  const [pick, setPick] = useState<number | undefined>(undefined);

  return (
    <div className="grid items-center gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Globe className="mx-auto aspect-square w-full max-w-[380px]" focus={pick} />

      <ol className="m-0 flex list-none flex-col p-0">
        {ROLLOUT.map((r) => {
          const on = pick === r.phase;
          return (
            <li key={r.phase}>
              <button
                type="button"
                onMouseEnter={() => setPick(r.phase)}
                onFocus={() => setPick(r.phase)}
                onMouseLeave={() => setPick(undefined)}
                onBlur={() => setPick(undefined)}
                onClick={() => setPick(on ? undefined : r.phase)}
                aria-pressed={on}
                className={[
                  "flex w-full cursor-pointer items-baseline gap-3 border-0 border-b border-line bg-transparent py-3 text-left transition-colors",
                  on ? "bg-key-soft" : "hover:bg-surface",
                ].join(" ")}
              >
                <span className={`num shrink-0 text-xs ${on ? "text-key" : "text-faint"}`}>
                  {String(r.phase).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <b className="text-xs font-bold text-ink">{r.region}</b>
                    {/* 공급인지 수요인지가 이 표의 핵심이라 지역 바로 옆에 붙는다. */}
                    <span
                      className={[
                        "rounded-full border px-1.5 py-px text-[10px]",
                        r.role === "공급" ? "border-accent text-accent" : "border-line text-muted",
                      ].join(" ")}
                    >
                      {r.role}
                    </span>
                    <span className="text-[10px] text-faint">{r.cited ? "인용" : "가정"}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-faint">{r.why}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* 기대효과.

   넷을 나란히 놓으면 각각 별개의 호재로 읽힌다. 실제로는 하나가 붙으면
   다음 것이 싸게 붙는 사슬이라, 번호를 매기고 마지막에 어느 지표가 움직이는지
   붙여 둔다. 반영 안 했다는 표시가 각 칸에 있어야 합산해 읽지 않는다. */
function Upside() {
  return (
    <div>
      <ol className="m-0 grid list-none gap-x-10 gap-y-6 p-0 sm:grid-cols-2">
        {UPSIDE.map((u) => (
          <li
            key={u.no}
            className="rounded-lg border border-line p-4 transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-accent motion-reduce:hover:translate-y-0"
          >
            <span className="flex items-baseline gap-2.5">
              <span className="num text-xs text-faint">{String(u.no).padStart(2, "0")}</span>
              <b className="text-base font-bold text-ink">{u.name}</b>
            </span>
            <p className="mt-3 text-xs text-muted">{u.opens}</p>
            <p className="mt-1 text-xs text-muted">{u.effect}</p>
            <p className="mt-3 flex items-baseline gap-2 border-t border-line pt-3 text-xs text-faint">
              움직이는 지표
              <b className="num text-xs text-accent">{u.metric}</b>
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-faint">{UPSIDE_NOTE}</p>
    </div>
  );
}

/** 요약의 MRR. 천 단위 구분이 붙어야 자릿수를 잘못 읽지 않는다. */
function SummaryMrr() {
  const [ref, shown] = useCountUp(STREAM_TOTAL.mrr);
  return <span ref={ref}>{Number(shown).toLocaleString("ko-KR")}</span>;
}

/* 기업가치.

   투자자가 이 회사에 대해 답을 원하는 건 넷이다 — 한 곳을 데려와 얼마를 버는가,
   데려온 곳이 얼마나 남는가, 회사가 얼마인가, 틀리면 어디까지 밀리는가.
   계산 과정은 안 낸다. 스킬로 돌린 결과만 낸다. 유도식을 펴 놓으면
   숫자가 아니라 식을 검토하게 되고, 그건 이 페이지가 할 일이 아니다. */
function Valuation() {
  const [barRef, seen] = useSeen<HTMLDListElement>();
  const [bandRef, bandSeen] = useSeen<HTMLDivElement>();

  return (
    <div className="flex flex-col gap-10">
      {/* 유닛. 제일 먼저 온다 — 나머지 숫자가 전부 여기서 나온다.
          네 칸 중 LTV/CAC 하나만 강조한다. 투자자가 이 줄에서 실제로 보는 값이다. */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-7 border-b border-line pb-8 lg:grid-cols-4">
        {UNIT.map(([k, v, why], i) => {
          const key = i === UNIT.length - 1;
          return (
            <div
              key={k}
              className={[
                "-mx-3 rounded-lg px-3 py-2 transition-colors",
                key ? "bg-key-soft" : "hover:bg-surface",
              ].join(" ")}
            >
              <dt className={`text-xs ${key ? "font-bold text-key" : "text-faint"}`}>{k}</dt>
              <dd className="m-0 mt-1">
                {key ? <Key value={5.9} suffix="배" decimals={1} /> : <span className="num text-2xl text-ink">{v}</span>}
              </dd>
              <dd className="m-0 mt-1 text-[10px] text-faint">{why}</dd>
            </div>
          );
        })}
      </dl>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        {/* 잔존. 유닛이 성립해도 안 남으면 무의미하다.
            막대는 화면에 들어올 때 0 에서 늘어난다. 뒤 구간일수록 늦게 출발해
            곡선이 꺾이는 순서가 그대로 보인다. */}
        <div>
          <p className="mb-4 text-xs font-bold text-ink">
            잔존율<span className="ml-2 font-normal text-faint">가입 시점 기준</span>
          </p>
          <dl ref={barRef} className="m-0">
            {RETENTION.map(([k, v], i) => (
              <div
                key={k}
                className="group -mx-3 flex items-center gap-3 rounded-lg border-b border-line px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface"
              >
                <dt className="num w-12 shrink-0 text-xs text-faint transition-colors group-hover:text-ink">{k}</dt>
                <dd className="m-0 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: seen ? `${v}%` : "0%", transitionDelay: `${i * 110}ms` }}
                  />
                </dd>
                <dd className="num m-0 w-10 shrink-0 text-right text-xs font-bold text-ink">{v}%</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 분포. 점추정 하나를 내면 그 숫자만 공격받는다. 폭을 그대로 낸다.
            띠는 중앙값에서 양쪽으로 벌어진다 — 이 그림이 말하는 게 "가운데가
            하나 있고 그 주변이 이만큼 넓다" 라서 방향이 그래야 맞다. */}
        <div ref={bandRef}>
          <p className="mb-4 text-xs font-bold text-ink">
            기업가치
            <span className="ml-2 font-normal text-faint">
              {VALUATION.runs}, 할인율 {VALUATION.discount}
            </span>
          </p>
          <p>
            <Key value={4.5} suffix="억" decimals={1} size="lg" />
          </p>
          <p className="mt-2 text-xs text-faint">중앙값</p>

          {/* 축은 0 에서 9억. 굵은 띠가 p10–p90, 세로선이 중앙값이다. */}
          <div className="relative mt-8 h-1.5 rounded-full bg-line">
            <span
              className="absolute inset-y-0 rounded-full bg-key/35 transition-[left,right] duration-700 ease-out motion-reduce:transition-none"
              style={{ left: bandSeen ? "7.8%" : "50%", right: bandSeen ? "7.8%" : "50%" }}
            />
            <span className="absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-key" />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["하위 10%", VALUATION.p10],
              ["중앙", VALUATION.p50],
              ["상위 10%", VALUATION.p90],
            ].map(([k, v], i) => (
              <div key={k} className={i === 2 ? "text-right" : i === 1 ? "text-center" : ""}>
                <dt className="text-[10px] text-faint">{k}</dt>
                <dd className={`num m-0 text-xs font-bold ${i === 1 ? "text-key" : "text-ink"}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 flex items-baseline gap-2 border-t border-line pt-4 text-xs text-faint">
            손실 확률
            <b className="num text-base text-ink">{VALUATION.lossChance}</b>
          </p>
        </div>
      </div>

      {/* 시나리오. 틀렸을 때 어디까지 밀리는지가 마지막 질문이다.
          기준안만 강조한다. 셋 다 칠하면 어느 것이 우리 주장인지 안 보인다. */}
      <div className="border-t border-line pt-8">
        <p className="mb-5 text-xs font-bold text-ink">
          시나리오<span className="ml-2 font-normal text-faint">60개월 현재가치</span>
        </p>
        <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-3">
          {SCENARIOS.map(([k, v, why], i) => {
            const base = i === 1;
            return (
              <div
                key={k}
                className={[
                  "rounded-r-lg border-l-2 py-1 pl-4 transition-[background-color,translate] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                  base ? "border-key bg-key-soft" : "border-line hover:bg-surface",
                ].join(" ")}
              >
                <dt className={`text-xs ${base ? "font-bold text-key" : "text-faint"}`}>{k}</dt>
                <dd className={`num m-0 mt-1 text-2xl ${base ? "text-key" : "text-ink"}`}>{v}</dd>
                <dd className="m-0 mt-1 text-[10px] text-faint">{why}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

/* 수익원 셋. 성격이 달라 한 표에 못 담는다 — 구독은 매달, 수수료는 거래마다,
   크레딧은 쓴 만큼 받는다. 세로로 쌓으면 셋이 같은 무게로 읽혀 주 수익원이
   무엇인지 안 보이므로, 옆으로 넘겨 하나씩 본다. */
function Streams() {
  const [i, setI] = useState(0);

  return (
    <div className="mb-10">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {STREAMS.map((s, k) => (
          <button
            key={s.no}
            type="button"
            onClick={() => setI(k)}
            aria-pressed={i === k}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs",
              i === k
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            <span className="num opacity-60">{s.no}</span>
            {s.name}
          </button>
        ))}
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
            aria-label="이전 수익원"
            className="cursor-pointer rounded border border-line bg-transparent px-2 py-1 text-xs text-faint hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={i === STREAMS.length - 1}
            onClick={() => setI(i + 1)}
            aria-label="다음 수익원"
            className="cursor-pointer rounded border border-line bg-transparent px-2 py-1 text-xs text-faint hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </span>
      </div>

      {/* 넘길 때 옆으로 미끄러진다. 순서가 있는 것끼리는 방향이 보여야 한다. */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {STREAMS.map((s) => (
            <div key={s.no} className="w-full shrink-0 pr-1">
              <div className="grid gap-x-10 gap-y-5 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <p className="text-xs text-faint">
                    {s.who} 에게 {s.how}
                  </p>
                  <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
                    {s.assume.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-faint">{k}</dt>
                        <dd className="num m-0 text-base text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="num mt-4 border-t border-line pt-3 text-xs text-muted">{s.calc}</p>
                  <p className="mt-2 text-xs text-faint">{s.note}</p>
                </div>

                <div className="sm:border-l sm:border-line sm:pl-6">
                  <p className="text-xs text-faint">월 기여</p>
                  <p className="num mt-1 text-4xl leading-none text-ink">
                    {s.mrr.toLocaleString("ko-KR")}
                    <span className="ml-1 text-base text-muted">만원</span>
                  </p>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <b
                      className="block h-full bg-accent"
                      style={{ width: `${(s.mrr / STREAM_TOTAL.mrr) * 100}%` }}
                    />
                  </span>
                  <p className="mt-1.5 text-xs text-faint">
                    전체의 {Math.round((s.mrr / STREAM_TOTAL.mrr) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 셋을 넘겨 본 다음 마지막에 합계가 온다. 이 블록의 결론이라 강조한다. */}
      <dl className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-line pt-4">
        <div className="-mx-2 flex items-baseline gap-2 rounded-lg bg-key-soft px-2 py-1">
          <dt className="text-xs font-bold text-key">합계 MRR</dt>
          <dd className="num m-0 text-2xl text-key">{STREAM_TOTAL.mrr.toLocaleString("ko-KR")}만원</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-xs text-faint">연 환산</dt>
          <dd className="num m-0 text-base text-ink">{STREAM_TOTAL.arr}</dd>
        </div>
      </dl>
    </div>
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
      <div className="flex flex-col gap-5">
        {REVENUE_FUNNEL.map((s) => (
          <div key={s.label}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-ink">{s.label}</span>
              {s.rate && <span className="text-[10px] text-accent">{s.rate}</span>}
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
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className="num mt-3 text-4xl leading-none text-ink">
        <span ref={ref}>{pretty}</span>
        <span className="ml-1 text-base text-muted">{unit}</span>
      </p>
      <p className="mt-2 text-xs text-muted">{note}</p>
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
        "grid gap-x-12 gap-y-6 border-t border-line pt-12 pb-24 transition-all duration-700",
        "lg:grid-cols-[184px_minmax(0,1fr)]",
        on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      ].join(" ")}
    >
      <div className="lg:sticky lg:top-[120px] lg:self-start">
        <span className="num block text-xs text-faint">{n}</span>
        <h2 className="mt-1 text-2xl leading-snug font-bold text-ink">{title}</h2>
        {lead && <p className="mt-2 truncate text-xs text-muted" title={lead}>{lead}</p>}
      </div>
      <div className="min-w-0 lg:pr-8">{children}</div>
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
