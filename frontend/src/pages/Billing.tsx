import { Link } from "react-router-dom";

import { CREDIT_COST, PACKS, PLANS } from "../data/plans";
import { useAccount } from "../lib/account";
import { t } from "../lib/locale";

/* 요금.

   구독과 충전을 한 화면에 둔다. 나누면 "구독하면 크레딧이 따로 필요한가"
   라는 질문이 남고, 그 질문이 남으면 둘 다 안 산다.

   순서는 구독 먼저다. 접근이 없으면 크레딧을 사도 쓸 데가 없다. */

const won = (n: number) => n.toLocaleString("ko-KR");

export function Billing() {
  const auth = useAccount();
  const signed = auth.status === "signed";

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-12">
      <p className="text-xs tracking-wide text-accent">{t("요금")}</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">{t("접근은 구독, 생성은 크레딧")}</h1>
      <p className="mt-2 text-xs text-muted">
        {t("카탈로그를 보는 데는 정액, AI로 만드는 데는 쓴 만큼 냅니다.")}
      </p>

      {/* 구독 */}
      <section className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={[
                "flex flex-col rounded-2xl border p-5",
                p.featured ? "border-accent bg-accent-soft" : "border-line bg-surface",
              ].join(" ")}
            >
              <p className="flex items-baseline gap-2">
                <b className="text-base font-bold text-ink">{t(p.name)}</b>
                {p.featured && <span className="text-[10px] text-accent">{t("많이 고릅니다")}</span>}
              </p>
              <p className="mt-1 text-[10px] text-faint">{t(p.who)}</p>

              <p className="num mt-5 text-2xl leading-none text-ink">
                {p.won === 0 ? "0" : won(p.won)}
                <span className="ml-1 text-xs font-normal text-faint">
                  {t("원")}
                  {p.won > 0 && ` ${t("/ 월")}`}
                </span>
              </p>
              <p className="mt-2 text-xs text-accent">
                {t("크레딧")} <b className="num">{p.credits}</b>
                <span className="text-faint"> {t("/ 월")}</span>
              </p>

              <ul className="m-0 mt-5 flex flex-1 list-none flex-col gap-2 p-0">
                {p.features.map((f) => (
                  <li key={f} className="text-xs text-muted">
                    {t(f)}
                  </li>
                ))}
              </ul>

              <Link
                to={signed ? "/library" : "/join"}
                className={[
                  "mt-6 rounded-xl px-4 py-2.5 text-center text-xs font-bold no-underline",
                  p.featured
                    ? "bg-accent text-ground hover:bg-accent-strong"
                    : "border border-line text-muted hover:border-accent hover:text-ink",
                ].join(" ")}
              >
                {t(p.won === 0 ? "그냥 시작하기" : "고르기")}
              </Link>
            </div>
          ))}
        </div>

        {/* 롤오버 규칙을 여기서 밝힌다. 결제하고 나서 알면 늦다. */}
        <p className="mt-4 text-[10px] leading-relaxed text-faint">
          {t("구독에 포함된 크레딧은 매달 리셋됩니다. 충전한 크레딧은 만료가 없습니다 — 돈을 내고 산 것을 태우는 건 다른 문제입니다.")}
        </p>
      </section>

      {/* 충전 */}
      <section className="mt-14 border-t border-line pt-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold text-ink">{t("충전")}</h2>
          <p className="text-xs text-muted">{t("구독 크레딧이 모자랄 때. 만료 없습니다.")}</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PACKS.map((p) => (
            <div key={p.credits} className="rounded-2xl border border-line bg-surface p-5">
              <p className="num text-2xl leading-none text-ink">
                {p.credits}
                <span className="ml-1 text-xs font-normal text-faint">{t("크레딧")}</span>
              </p>
              <p className="num mt-3 text-base text-accent">{t("{v}원", { v: won(p.won) })}</p>
              {/* 개당 값을 적어 준다. 비교를 화면 밖에서 하게 만들면 안 산다. */}
              <p className="mt-1 text-[10px] text-faint">
                {t("개당 {v}원", { v: Math.round(p.won / p.credits) })}
              </p>
              <Link
                to={signed ? "/library" : "/join"}
                className="mt-5 block rounded-xl border border-line px-4 py-2.5 text-center text-xs font-semibold text-muted no-underline hover:border-accent hover:text-ink"
              >
                {t("충전")}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 크레딧이 얼마나 가는지. 숫자만 있으면 40이 많은지 적은지 모른다. */}
      <section className="mt-14 border-t border-line pt-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold text-ink">{t("크레딧")}</h2>
          <p className="text-xs text-muted">{t("한 번 만들 때 드는 값입니다.")}</p>
        </div>

        <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-3">
          {CREDIT_COST.map(([id, label, cost, note]) => (
            <div key={id} className="border-t border-line pt-4">
              <dt className="text-xs text-faint">{t(label)}</dt>
              <dd className="num m-0 mt-1 text-2xl text-ink">
                {cost}
                <span className="ml-1 text-xs font-normal text-faint">{t("크레딧")}</span>
              </dd>
              <dd className="m-0 mt-1 text-[10px] text-faint">{t(note)}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-[10px] leading-relaxed text-faint">
          {t("만들다 실패하면 크레딧을 돌려드립니다. 우리 쪽이나 생성 서비스 쪽 문제로 실패한 것을 쓰신 분이 물 이유가 없습니다.")}
        </p>
      </section>
    </main>
  );
}
