import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { ApiError, api } from "../lib/api";
import { useAccount } from "../lib/account";
import { t } from "../lib/locale";

/* 내 라이브러리.

   업로드를 네비 최상단에 단독으로 두면 로그인 안 한 사람에게도 보이고,
   눌러 봐야 로그인 화면으로 튕긴다. 로그인한 사람에게만 라이브러리를 열고
   그 안에 올리기를 둔다 — 산 것, 올린 것, 만든 것이 한자리에 모인다.

   탭 셋은 소유의 세 경로다. 화면을 나누면 "내가 가진 게 어디 있지" 를
   세 군데서 찾아야 한다. */

type Tab = "owned" | "mine" | "generated";

const TABS: [Tab, string][] = [
  ["owned", "산 것"],
  ["mine", "올린 것"],
  ["generated", "만든 것"],
];

type Owned = {
  asset_id: number;
  title: string;
  creator: string;
  badge: string | null;
  paid_usd: number;
};

type Job = {
  id: number;
  status: string;
  prompt: string;
  credits: number;
  error: string | null;
};

export function Library() {
  const auth = useAccount();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "owned";

  const [owned, setOwned] = useState<Owned[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "signed") return;
    let alive = true;

    // 둘을 같이 부른다. 탭을 눌렀을 때 다시 기다리면 화면이 깜빡인다.
    void Promise.allSettled([api.library(), api.generations()]).then(([lib, gen]) => {
      if (!alive) return;
      if (lib.status === "fulfilled") setOwned(lib.value.assets);
      if (gen.status === "fulfilled") {
        setJobs(gen.value.jobs);
        setCredits(gen.value.credits);
      }
      if (lib.status === "rejected" && gen.status === "rejected") {
        setError(
          lib.reason instanceof ApiError && lib.reason.status === 0
            ? t("서버에 닿지 못했습니다.")
            : t("불러오지 못했습니다."),
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [auth.status]);

  if (auth.status === "loading") {
    return <main className="mx-auto max-w-[840px] px-5 py-16 text-xs text-faint">{t("불러오는 중")}</main>;
  }
  if (auth.status === "anon") return <Navigate to="/join?mode=login" replace />;

  return (
    <main className="mx-auto max-w-[840px] px-5 py-12">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <div>
          <p className="text-xs tracking-wide text-accent">{auth.account.display_name}</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{t("내 라이브러리")}</h1>
        </div>

        {/* 올리기가 여기 산다. 네비 최상단이 아니라 라이브러리 안이다. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {credits !== null && (
            <Link
              to="/billing"
              className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted no-underline hover:border-accent hover:text-ink"
            >
              {t("크레딧")} <b className="num ml-1 text-ink">{credits}</b>
            </Link>
          )}
          <Link
            to="/generate"
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted no-underline hover:border-accent hover:text-ink"
          >
            {t("AI로 만들기")}
          </Link>
          <Link
            to="/upload"
            className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-ground no-underline hover:bg-accent-strong"
          >
            {t("에셋 올리기")}
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-1.5 border-b border-line pb-3">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams(key === "owned" ? {} : { tab: key })}
            aria-pressed={tab === key}
            className={[
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
              tab === key
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {t(label)}
            <span className={tab === key ? "ml-1.5 opacity-60" : "ml-1.5 text-faint"}>
              {key === "owned" ? (owned?.length ?? 0) : key === "generated" ? (jobs?.length ?? 0) : 0}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-8 rounded-xl border border-accent px-4 py-3 text-xs text-ink">
          {error}
        </p>
      )}

      {tab === "owned" && <Owned rows={owned} />}
      {tab === "mine" && <Mine />}
      {tab === "generated" && <Generated rows={jobs} />}
    </main>
  );
}

function Owned({ rows }: { rows: Owned[] | null }) {
  if (rows === null) return <Loading />;
  if (rows.length === 0) {
    return (
      <Empty
        what={t("아직 산 에셋이 없습니다.")}
        to="/market"
        cta={t("마켓 둘러보기")}
      />
    );
  }
  return (
    <ul className="m-0 mt-6 flex list-none flex-col p-0">
      {rows.map((a) => (
        <li key={a.asset_id}>
          <Link
            to={`/market/${a.asset_id}`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3.5 no-underline hover:bg-surface"
          >
            <b className="min-w-0 flex-1 truncate text-xs text-ink">{a.title}</b>
            <span className="text-xs text-faint">{a.creator}</span>
            {a.badge && <span className="text-xs text-accent">{a.badge}</span>}
            <span className="num text-xs text-muted">${a.paid_usd.toFixed(2)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* 올린 것.

   API 가 아직 "내가 올린 에셋" 을 안 준다. 창작자별 조회를 붙이기 전까지는
   비어 있다고 적는다 — 빈 목록을 그냥 보여 주면 안 올린 것처럼 읽힌다. */
function Mine() {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="text-xs text-muted">{t("올린 에셋 목록은 아직 준비 중입니다.")}</p>
      <p className="mt-1 text-[10px] text-faint">{t("창작자별 조회를 붙이면 여기에 뜹니다.")}</p>
      <Link
        to="/upload"
        className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-ground no-underline hover:bg-accent-strong"
      >
        {t("에셋 올리기")}
      </Link>
    </div>
  );
}

function Generated({ rows }: { rows: Job[] | null }) {
  if (rows === null) return <Loading />;
  if (rows.length === 0) {
    return <Empty what={t("아직 만든 것이 없습니다.")} to="/generate" cta={t("AI로 만들기")} />;
  }
  return (
    <ul className="m-0 mt-6 flex list-none flex-col p-0">
      {rows.map((j) => (
        <li
          key={j.id}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3.5"
        >
          <b className="min-w-0 flex-1 truncate text-xs text-ink">{j.prompt}</b>
          <span className={`text-xs ${j.status === "failed" ? "text-accent" : "text-faint"}`}>
            {STATUS_KO[j.status] ?? j.status}
          </span>
          <span className="num text-xs text-muted">{j.credits} 크레딧</span>
          {j.error && (
            <p className="w-full truncate text-[10px] text-faint" title={j.error}>
              {j.error}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

const STATUS_KO: Record<string, string> = {
  queued: "대기 중",
  running: "만드는 중",
  done: "완료",
  failed: "실패",
};

function Loading() {
  return <p className="mt-8 text-xs text-faint">{t("불러오는 중")}</p>;
}

function Empty({ what, to, cta }: { what: string; to: string; cta: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center">
      <p className="text-xs text-muted">{what}</p>
      <Link
        to={to}
        className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-ground no-underline hover:bg-accent-strong"
      >
        {cta}
      </Link>
    </div>
  );
}
