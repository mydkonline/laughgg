import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { ApiError, api, type GenJob } from "../lib/api";
import { CREDIT_COST } from "../data/plans";
import { useAccount } from "../lib/account";
import { t } from "../lib/locale";

/* AI 에셋 생성.

   요청은 큐에 넣고 202 로 돌아온다. 생성이 30초에서 5분 걸려서 응답을
   기다릴 수 없다 — 기다리면 서버가 그동안 워커를 붙잡는다.

   그래서 화면이 폴링한다. 진행률을 못 받는 대신 상태는 정확히 보여 준다.
   "만드는 중" 을 띄워 놓고 아무것도 안 하면 사람은 멈춘 줄 안다. */

const STYLES = [
  ["stylized", "스타일라이즈"],
  ["realistic", "사실적"],
  ["lowpoly", "로우폴리"],
  ["pixel", "도트"],
] as const;

/** 얼마나 자주 물어보나. 잦으면 서버가 놀고 뜸하면 끝난 걸 늦게 안다. */
const POLL_MS = 3000;

export function Generate() {
  const auth = useAccount();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("stylized");
  const [quality, setQuality] = useState<string>("standard");
  const [credits, setCredits] = useState<number | null>(null);
  const [jobs, setJobs] = useState<GenJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폴링 타이머. 화면을 떠나면 멈춰야 한다.
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (auth.status !== "signed") return;
    let alive = true;

    const load = async () => {
      try {
        const r = await api.generations();
        if (!alive) return;
        setCredits(r.credits);
        setJobs(r.jobs);
        // 끝나지 않은 게 있을 때만 계속 물어본다. 다 끝났는데 계속 물으면
        // 서버가 놀고, 사용자 배터리도 같이 논다.
        const pending = r.jobs.some((j) => j.status === "queued" || j.status === "running");
        if (pending) {
          timer.current = window.setTimeout(() => void load(), POLL_MS);
        }
      } catch {
        // 목록을 못 불러도 만드는 건 되어야 한다. 조용히 넘긴다.
      }
    };
    void load();

    return () => {
      alive = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [auth.status]);

  if (auth.status === "loading") {
    return <main className="mx-auto max-w-[720px] px-5 py-16 text-xs text-faint">{t("불러오는 중")}</main>;
  }
  if (auth.status === "anon") return <Navigate to="/join?mode=login" replace />;

  const cost = CREDIT_COST.find(([id]) => id === quality)?.[2] ?? 2;
  const short = credits !== null && credits < cost;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const job = await api.generate(prompt.trim(), style, quality);
      setJobs((prev) => [job, ...prev]);
      setCredits((c) => (c === null ? c : c - job.credits));
      setPrompt("");
      // 방금 넣은 게 끝나는 걸 봐야 하므로 폴링을 다시 시작한다.
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void api.generations().then((r) => {
          setCredits(r.credits);
          setJobs(r.jobs);
        });
      }, POLL_MS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError(t("크레딧이 모자랍니다. 충전하거나 품질을 낮춰 주세요."));
      } else if (err instanceof ApiError && err.status === 400) {
        setError(t("프롬프트를 확인해 주세요."));
      } else if (err instanceof ApiError && err.status === 503) {
        setError("생성 기능이 아직 켜져 있지 않습니다.");
      } else {
        setError("요청하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[720px] px-5 py-12">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <div>
          <p className="text-xs tracking-wide text-accent">{t("AI 에셋")}</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{t("만들기")}</h1>
        </div>
        {credits !== null && (
          <Link
            to="/billing"
            className="ml-auto rounded-full border border-line px-3.5 py-1.5 text-xs text-muted no-underline hover:border-accent hover:text-ink"
          >
            {t("크레딧")} <b className="num ml-1 text-ink">{credits}</b>
          </Link>
        )}
      </div>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-faint">{t("무엇을 만들까요")}</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            maxLength={500}
            rows={3}
            className="resize-y rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink placeholder:text-faint focus:border-accent"
            placeholder={t("이끼 낀 고딕 석상, 한쪽 팔이 부서진")}
          />
          <span className="num self-end text-[10px] text-faint">{prompt.length} / 500</span>
        </label>

        <Chips label={t("화풍")} value={style} onPick={setStyle} options={STYLES} />

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-10 shrink-0 text-xs text-faint">{t("품질")}</span>
          {CREDIT_COST.map(([id, label, c, note]) => (
            <button
              key={id}
              type="button"
              onClick={() => setQuality(id)}
              aria-pressed={quality === id}
              title={note}
              className={[
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
                quality === id
                  ? "border-transparent bg-ink font-bold text-ground"
                  : "border-line text-muted hover:border-accent hover:text-ink",
              ].join(" ")}
            >
              {label}
              <span className={quality === id ? "ml-1.5 opacity-60" : "ml-1.5 text-faint"}>
                {c}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-accent px-4 py-3 text-xs text-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !prompt.trim() || short}
          className="rounded-xl border-0 bg-accent px-6 py-3.5 text-xs font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "요청하는 중" : `만들기 · ${cost}크레딧`}
        </button>
        {short && (
          <p className="text-center text-[10px] text-faint">
            크레딧이 모자랍니다.{" "}
            <Link to="/billing" className="text-accent underline">
              {t("충전하기")}
            </Link>
          </p>
        )}
      </form>

      {jobs.length > 0 && (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-base font-bold text-ink">{t("요청한 것")}</h2>
          <ul className="m-0 mt-4 flex list-none flex-col p-0">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3"
              >
                <b className="min-w-0 flex-1 truncate text-xs text-ink">{j.prompt}</b>
                <Status status={j.status} />
                <span className="num text-xs text-faint">{j.credits}크레딧</span>
                {j.error && (
                  <p className="w-full truncate text-[10px] text-faint" title={j.error}>
                    {j.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[10px] leading-relaxed text-faint">
            {t("만들다 실패하면 크레딧을 돌려드립니다. 우리 쪽이나 생성 서비스 쪽 문제로 실패한 것을 쓰신 분이 물 이유가 없습니다.")}
          </p>
        </section>
      )}
    </main>
  );
}

function Status({ status }: { status: GenJob["status"] }) {
  const label = { queued: "대기 중", running: "만드는 중", done: "완료", failed: "실패" }[status];
  // 진행 중인 것만 움직인다. 다 끝난 목록이 계속 깜빡이면 눈이 간다.
  const moving = status === "queued" || status === "running";
  return (
    <span
      className={[
        "text-xs",
        status === "failed" ? "text-accent" : moving ? "text-muted" : "text-faint",
        moving ? "motion-safe:animate-pulse" : "",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function Chips({
  label,
  value,
  onPick,
  options,
}: {
  label: string;
  value: string;
  onPick: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-faint">{label}</span>
      {options.map(([key, name]) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          aria-pressed={value === key}
          className={[
            "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
            value === key
              ? "border-transparent bg-ink font-bold text-ground"
              : "border-line text-muted hover:border-accent hover:text-ink",
          ].join(" ")}
        >
          {t(name)}
        </button>
      ))}
    </div>
  );
}
