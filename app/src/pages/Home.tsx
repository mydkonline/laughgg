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

/* 파이프라인 아이콘. 이모지를 안 쓰고 같은 규격으로 직접 그린다 —
   24 뷰박스, 1.5 스트로크, 채우기 없음. 색은 상속받아 테마를 따라간다. */
const ICONS: Record<string, React.ReactNode> = {
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  scan: (
    <>
      <rect x="4" y="3" width="12" height="17" rx="1.5" />
      <path d="M7 8h6M7 11.5h6M7 15h3" />
      <circle cx="17" cy="16" r="3.4" />
      <path d="m19.6 18.6 1.9 1.9" />
    </>
  ),
  fix: (
    <>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m10.5 12.5 1.6 1.6 3.2-3.9" />
    </>
  ),
  match: (
    <>
      <path d="M4 8.5 10 5l6 3.5v7L10 19l-6-3.5z" />
      <path d="M10 12v7M4 8.5 10 12l6-3.5" />
      <circle cx="18" cy="6" r="2.6" />
    </>
  ),
};

const STEPS: [keyof typeof ICONS, string, string][] = [
  ["upload", "업로드", "glb, gltf, png"],
  ["scan", "AI 정적 분석", "7항목, 라이선스 60 미만 탈락"],
  ["fix", "개선 코드", "떨어진 항목만"],
  ["match", "컨셉 정합", "톤과 팔레트 변경"],
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
          <h1 className="text-4xl leading-[1.2] font-bold text-ink">검증된 게임 에셋 마켓</h1>
          <p className="mt-3 max-w-[52ch] text-xs text-muted">
            올라온 에셋을 AI 정적 분석 7항목으로 채점해 배지를 매깁니다. 구매한 에셋은 에디터에서
            게임 컨셉에 맞춰 변환해 내려받습니다.
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
              스튜디오에서 맞춰 보기
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
          <h2 className="text-2xl font-bold text-ink">파이프라인</h2>
          <ol className="mt-8 grid list-none gap-px overflow-hidden rounded-xl border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([icon, t, d], i) => (
              <li key={t} className="flex flex-col items-start gap-3 bg-surface p-5">
                <span className="flex w-full items-start justify-between">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8 text-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {ICONS[icon]}
                  </svg>
                  <b className="num text-xs text-faint">{String(i + 1).padStart(2, "0")}</b>
                </span>
                <p className="text-base font-bold text-ink">{t}</p>
                <p className="text-xs text-faint">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 배지 */}
      <section className="mx-auto max-w-[1240px] px-5 py-16">
        <h2 className="text-2xl font-bold text-ink">배지</h2>
        <p className="mt-2 text-xs text-muted">점수에 따라 부여되며 노출 순위를 정합니다. 수수료와는 무관합니다.</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t.badge} className="flex flex-col items-start gap-3 bg-surface p-6">
              <RankIcon badge={t.badge} size={48} />
              <p className="text-2xl font-bold text-ink">{BADGE_LABEL[t.badge]}</p>
              <p className="text-xs tabular-nums text-faint">{t.range}</p>
              <p className="text-xs text-faint">{t.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 정산 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:grid-cols-2">
          <div>
            <p className="num text-6xl text-ink">92%</p>
            <p className="mt-2 text-xs text-muted">창작자 정산 비율</p>
          </div>
          <div>
            <p className="num text-6xl text-ink">8%</p>
            <p className="mt-2 text-xs text-muted">거래 수수료. Epic Fab 12%, Unity 30%</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20 text-center">
        <h2 className="text-2xl font-bold text-ink">AI 스튜디오</h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-xs text-muted">
          파일을 올리면 점수가 나오고, 게임 컨셉에 맞춰 변환해 내려받습니다. 3D 와 2D 둘 다 됩니다.
        </p>
        <Link
          to="/workshop"
          className="mt-6 inline-block rounded-xl bg-accent px-8 py-4 text-base font-bold text-white no-underline hover:bg-accent-strong"
        >
          스튜디오 열기
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
            <b className="num text-2xl text-ink">{score}</b>
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
      <dd className="num m-0 text-2xl text-ink">{v}</dd>
    </div>
  );
}
