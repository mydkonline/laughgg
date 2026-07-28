import { Link } from "react-router-dom";
import { PIECES, modelSrc } from "../data/pieces";
import { CONCEPTS } from "../data/concepts";
import { PALETTES } from "../data/palettes";
import { RankIcon, BADGE_LABEL, type BadgeKey } from "../components/Rank";
import { Spin } from "../three/Spin";
import { t } from "../lib/locale";

/* 히어로에 세우는 모델. 채점 눈금이 붙는 그림이라 대표작 하나를 고정한다. */
const HERO = PIECES.find((p) => p.m === "gothic_statue") ?? PIECES[0]!;

/* 홈 — 무엇을 파는 곳인지 한 화면에서 끝난다.
   에셋을 파는 게 아니라 "쓸 만한지 보증"을 판다는 게 요지고, 그건 글보다
   에셋 하나에 점수가 붙는 그림으로 보여야 빨리 읽힌다. */


/* 파이프라인 아이콘. 이모지를 안 쓰고 같은 규격으로 직접 그린다 —
   24 뷰박스, 1.5 스트로크, 채우기 없음, 색은 상속.

   추상 기호 대신 게임 제작에서 실제로 쓰는 물건을 그린다. 개발자가 매일 보는
   모양이라 설명 없이 읽힌다 — 에셋 큐브, 계측 눈금, 셰이더 노드, 팔레트. */
const ICONS: Record<string, React.ReactNode> = {
  /* 에셋 큐브가 파이프라인으로 들어간다 */
  upload: (
    <>
      <path d="M12 12.6 4.5 8.3 12 4l7.5 4.3z" />
      <path d="M4.5 8.3v7.4L12 20l7.5-4.3V8.3" />
      <path d="M12 12.6V20" />
      <path d="M12 2v2" />
    </>
  ),
  /* 계측. 면과 비용을 눈금으로 잰다 */
  scan: (
    <>
      <path d="M3 16.5 9 9l4 4.5L21 5" />
      <path d="M3 20h18" />
      <path d="M6 20v-2.5M10 20v-4.5M14 20v-3M18 20v-6" />
    </>
  ),
  /* 셰이더 노드. 떨어진 항목을 다시 잇는다 */
  fix: (
    <>
      <rect x="3" y="5" width="6" height="5" rx="1" />
      <rect x="15" y="14" width="6" height="5" rx="1" />
      <path d="M9 7.5h3a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2" />
      <path d="M6 10v3.5" />
    </>
  ),
  /* 팔레트. 게임의 색으로 맞춘다 */
  match: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.9A4.4 4.4 0 0 0 20.5 11c0-4.1-3.8-7.5-8.5-7.5z" />
      <circle cx="8" cy="11" r="1" />
      <circle cx="11" cy="7.5" r="1" />
      <circle cx="15" cy="8.5" r="1" />
    </>
  ),
};

const STEPS: [keyof typeof ICONS, string, string][] = [
  ["upload", "업로드", "glb, gltf, png"],
  ["scan", "분석", "학습 소스 역추적, 7항목 가중 채점"],
  ["fix", "프롬프트 보완", "떨어진 항목만 다시 생성"],
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
      {/* 히어로. 왼쪽은 말, 오른쪽은 그 말의 증거(채점 눈금이 붙은 모델).
          진입은 마켓 하나로 모은다 — 프롬프트 조정 버튼과 시연은 뺐고,
          컨셉 변환은 상단 내비의 스튜디오에 있다. */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h1 className="text-4xl leading-[1.2] font-bold text-ink">{t("검증된 게임 에셋 마켓")}</h1>
          <p className="mt-3 max-w-[52ch] text-xs text-muted">
            {t("올라온 에셋을 7항목으로 채점해 배지를 매깁니다. 배지가 높을수록 목록 위에 노출됩니다.")}
          </p>

          {/* 진입 박스. 오른쪽 끝을 제목 끝에 맞춘다 — 컬럼 전체로 늘리면
              제목보다 한참 튀어나와 균형이 깨진다. 제목 폭(약 17rem)에 맞춰
              가둔다. 강조색 하나, 아이콘 없이. */}
          <Link
            to="/market"
            className="mt-7 block w-full max-w-[17rem] rounded-xl bg-accent px-5 py-3.5 text-center text-base font-bold text-white no-underline transition-colors hover:bg-accent-strong"
          >
            {t("마켓 둘러보기")}
          </Link>

          <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-line pt-6">
            <Stat k={t("등록된 에셋")} v={t("{n}종", { n: PIECES.length })} />
            <Stat k={t("맞출 수 있는 컨셉")} v={t("{n}종", { n: CONCEPTS.length })} />
            <Stat k={t("고정 팔레트")} v={t("{n}종", { n: PALETTES.length - 1 })} />
          </dl>
        </div>

        <HeroShot />
      </section>

      {/* 진행 순서 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-5 py-16">
          <h2 className="text-2xl font-bold text-ink">{t("방식")}</h2>
          <p className="mt-2 text-xs text-muted">{t("올린 파일이 배지를 받기까지 네 단계.")}</p>
          <ol className="mt-8 grid list-none gap-px overflow-hidden rounded-xl border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([icon, step, detail], i) => (
              <li key={step} className="flex flex-col items-start gap-4 bg-surface p-6">
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
                <p className="text-base font-bold text-ink">{t(step)}</p>
                <p className="text-xs text-faint">{t(detail)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 배지 */}
      <section className="mx-auto max-w-[1240px] px-5 py-16">
        <h2 className="text-2xl font-bold text-ink">{t("배지")}</h2>
        <p className="mt-2 text-xs text-muted">{t("수수료가 아니라 노출 순위를 정합니다.")}</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div key={tier.badge} className="flex flex-col items-start gap-4 bg-surface p-7">
              <RankIcon badge={tier.badge} size={48} />
              <p className="text-2xl font-bold text-ink">{t(BADGE_LABEL[tier.badge])}</p>
              <p className="text-xs tabular-nums text-faint">{t(tier.range)}</p>
              <p className="text-xs text-faint">{t(tier.note)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 정산. 숫자 둘만 놓으면 비교가 안 된다.
          게임에서 익숙한 전리품 분배 막대로 보여 준다. */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1240px] px-5 py-16">
          <h2 className="text-2xl font-bold text-ink">{t("정산")}</h2>
          <p className="mt-2 text-xs text-muted">{t("에셋 하나가 팔릴 때 어디로 얼마가 가는지.")}</p>

          <div className="mt-8 flex h-16 overflow-hidden rounded-lg border border-line">
            <span className="flex items-center justify-center bg-accent" style={{ flexGrow: 92 }}>
              <b className="num text-2xl text-white">92%</b>
            </span>
            <span className="flex items-center justify-center bg-chrome-700" style={{ flexGrow: 8 }}>
              <b className="num text-xs text-white">8%</b>
            </span>
          </div>

          <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <div className="flex items-baseline gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-sm bg-accent" />
              <dt className="text-xs font-bold text-ink">{t("창작자")}</dt>
              <dd className="m-0 text-xs text-faint">{t("만든 사람 몫")}</dd>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-sm bg-chrome-700" />
              <dt className="text-xs font-bold text-ink">LaughGG</dt>
              <dd className="m-0 text-xs text-faint">{t("거래 수수료")}</dd>
            </div>
          </dl>

          {/* 남의 몫과 비교해야 8% 가 낮다는 게 보인다. */}
          <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
            {[
              ["LaughGG", 8],
              ["Epic Fab", 12],
              ["Unity Asset Store", 30],
            ].map(([name, v], i) => (
              <div key={name as string} className="flex items-center gap-3">
                <span className={`w-32 shrink-0 text-xs ${i === 0 ? "font-bold text-ink" : "text-muted"}`}>
                  {name}
                </span>
                <span className="block h-2.5 flex-1 overflow-hidden rounded-sm bg-surface-2">
                  <b
                    className={`block h-full ${i === 0 ? "bg-accent" : "bg-chrome-700"}`}
                    style={{ width: `${((v as number) / 30) * 100}%` }}
                  />
                </span>
                <b className={`num w-10 shrink-0 text-right text-xs ${i === 0 ? "text-accent" : "text-ink"}`}>
                  {v}%
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20 text-center">
        <h2 className="text-2xl font-bold text-ink">{t("스튜디오")}</h2>
        <p className="mt-2 text-xs text-muted">{t("3D 와 2D 를 게임 컨셉에 맞춰 변환합니다.")}</p>
        <Link
          to="/workshop"
          className="mt-6 inline-block rounded-xl bg-accent px-8 py-4 text-base font-bold text-white no-underline hover:bg-accent-strong"
        >
          {t("스튜디오 열기")}
        </Link>
      </section>
    </main>
  );
}

/* 에셋 하나에 점수가 붙는 장면. 이 제품이 파는 게 무엇인지 한 컷으로 말한다.
   선은 모델 뒤로 지나가고, 점선은 아주 잘게 끊어 배경처럼 눕힌다. */

function HeroShot() {
  const marks: [string, string, string][] = [
    ["면 무결성", "96", "top-[14%] left-0"],
    ["런타임 성능", "92", "top-[42%] right-0"],
    ["라이선스 출처", "98", "bottom-[16%] left-[4%]"],
  ];

  return (
    <div className="relative aspect-[4/3]">
      <div className="absolute inset-0 z-[1]">
        {modelSrc(HERO) && <Spin model={modelSrc(HERO)!} className="h-full w-full" />}
      </div>

      {/* 눈금은 모델 위에 얹는다(z-2). 뜬 뒤 순서대로 올라온다 — 애니메이션은
          CSS 로만, 상태에 안 기댄다. */}
      {marks.map(([label, score, pos], i) => (
        <div
          key={label}
          className={`absolute z-[2] ${pos}`}
          style={{ animation: "rise .6s ease both", animationDelay: `${300 + i * 220}ms` }}
        >
          <div className="flex items-baseline gap-2 border-b border-dashed border-line pb-1">
            <span className="text-xs text-faint">{t(label)}</span>
            <b className="num text-2xl text-ink">{score}</b>
          </div>
        </div>
      ))}

      <div
        className="absolute right-0 bottom-0 z-[3] flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5"
        style={{ animation: "rise .6s ease both", animationDelay: "960ms" }}
      >
        <RankIcon badge="chal" size={18} />
        <b className="text-base font-extrabold text-accent">{t("챌린저")} 94</b>
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
