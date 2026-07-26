import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PIECES } from "../data/pieces";
import { CONCEPTS } from "../data/concepts";
import { PALETTES } from "../data/palettes";
import { Spin } from "../three/Spin";
import { modelSrc } from "../data/pieces";
import { RankIcon, BADGE_LABEL, type BadgeKey } from "../components/Rank";

/* 홈 — 무엇을 파는 곳인지 한 화면에서 끝난다.
   에셋을 파는 게 아니라 "쓸 만한지 보증"을 판다는 게 요지고, 그건 글보다
   에셋 하나에 점수가 붙는 그림으로 보여야 빨리 읽힌다. */

const HERO = PIECES.find((p) => p.m === "gothic_statue") ?? PIECES[0]!;

const STEPS: [string, string][] = [
  ["올린다", "glb, gltf, png. 변환 없이"],
  ["검수한다", "7항목 자동 채점. 라이선스 60 미만은 탈락"],
  ["고친다", "떨어진 항목의 수정 코드 생성"],
  ["맞춘다", "게임 컨셉에 맞춰 톤과 팔레트 변경"],
];

const TIERS: { badge: BadgeKey; range: string; note: string }[] = [
  { badge: "chal", range: "90점 이상", note: "프로덕션 투입 가능" },
  { badge: "dia", range: "80점 이상", note: "손볼 곳 한둘" },
  { badge: "plat", range: "70점 이상", note: "정리 필요" },
  { badge: "silv", range: "70점 미만", note: "노출 제외" },
];

export function Home() {
  return (
    <main>
      {/* 히어로 */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-xs tracking-wide text-accent">게임 에셋 마켓</p>
          <h1 className="mt-2 text-6xl leading-[1.1] font-bold text-ink">
            쓸 만한지
            <br />
            사기 전에 압니다
          </h1>
          <p className="mt-4 max-w-[42ch] text-base text-muted">
            7항목으로 채점해 배지를 매깁니다. 사는 쪽은 점수로 고르고 컨셉에 맞춰 내려받습니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/market"
              className="rounded-xl bg-accent px-6 py-3.5 text-base font-bold text-white no-underline hover:bg-accent-strong"
            >
              마켓 둘러보기
            </Link>
            <Link
              to="/workshop"
              className="rounded-xl border border-line px-6 py-3.5 text-base font-semibold text-muted no-underline hover:border-accent hover:text-ink"
            >
              공방에서 맞춰 보기
            </Link>
          </div>

          <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-5">
            <Stat k="등록된 에셋" v={`${PIECES.length}종`} />
            <Stat k="맞출 수 있는 컨셉" v={`${CONCEPTS.length}종`} />
            <Stat k="고정 팔레트" v={`${PALETTES.length - 1}종`} />
          </dl>
        </div>

        <HeroShot />
      </section>

      {/* 진행 순서 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-5 py-16">
          <h2 className="text-4xl font-bold text-ink">올린 뒤에 일어나는 일</h2>
          <ol className="mt-8 grid list-none gap-px overflow-hidden rounded-xl border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="bg-surface p-5">
                <b className="text-xs tabular-nums text-faint">{String(i + 1).padStart(2, "0")}</b>
                <p className="mt-2 text-2xl font-bold text-ink">{t}</p>
                <p className="mt-2 text-base leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 배지 */}
      <section className="mx-auto max-w-[1240px] px-5 py-16">
        <h2 className="text-4xl font-bold text-ink">배지가 노출 순위를 정합니다</h2>
        <p className="mt-2 text-base text-muted">수수료는 8% 단일. 배지는 값이 아니라 자리를 정합니다.</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t.badge} className="flex flex-col items-start gap-3 bg-surface p-6">
              <RankIcon badge={t.badge} size={48} />
              <p className="text-2xl font-bold text-ink">{BADGE_LABEL[t.badge]}</p>
              <p className="text-xs tabular-nums text-faint">{t.range}</p>
              <p className="text-base leading-relaxed text-muted">{t.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 정산 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:grid-cols-2">
          <div>
            <p className="text-6xl font-bold tabular-nums text-ink">92%</p>
            <p className="mt-2 text-base text-muted">창작자 정산</p>
          </div>
          <div>
            <p className="text-6xl font-bold tabular-nums text-ink">8%</p>
            <p className="mt-2 text-base text-muted">단일 수수료. Epic Fab 12%, Unity 30%</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20 text-center">
        <h2 className="text-4xl font-bold text-ink">가진 에셋이 몇 점인지 보기</h2>
        <Link
          to="/workshop"
          className="mt-6 inline-block rounded-xl bg-accent px-8 py-4 text-base font-bold text-white no-underline hover:bg-accent-strong"
        >
          공방 열기
        </Link>
      </section>
    </main>
  );
}

/* 에셋 하나에 점수가 붙는 장면. 이 제품이 파는 게 무엇인지 한 컷으로 말한다.
   선은 모델 뒤로 지나가고, 점선은 아주 잘게 끊어 배경처럼 눕힌다. */
function HeroShot() {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setOn(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const marks: [string, string, string][] = [
    ["면 무결성", "96", "top-[14%] left-0"],
    ["런타임 성능", "92", "top-[42%] right-0"],
    ["라이선스 출처", "98", "bottom-[16%] left-[4%]"],
  ];

  return (
    <div ref={ref} className="relative aspect-[4/3]">
      <div className="absolute inset-0 z-[2]">
        {modelSrc(HERO) && <Spin model={modelSrc(HERO)!} className="h-full w-full" />}
      </div>

      {marks.map(([label, score, pos], i) => (
        <div
          key={label}
          className={[
            "absolute z-[1] transition-opacity duration-700",
            pos,
            on ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ transitionDelay: `${300 + i * 220}ms` }}
        >
          <div className="flex items-baseline gap-2 border-b border-dashed border-line pb-1">
            <span className="text-xs text-faint">{label}</span>
            <b className="text-2xl font-bold tabular-nums text-ink">{score}</b>
          </div>
        </div>
      ))}

      <div
        className={[
          "absolute right-0 bottom-0 z-[3] flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 transition-opacity duration-700",
          on ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ transitionDelay: "960ms" }}
      >
        <RankIcon badge="chal" size={18} />
        <b className="text-base font-extrabold text-accent">챌린저 94</b>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 text-2xl font-bold tabular-nums text-ink">{v}</dd>
    </div>
  );
}
