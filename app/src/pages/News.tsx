import { useMemo, useState } from "react";
import { NEWS, type News as Item } from "../data/news";
import { NEWS_EN } from "../i18n/en/news";
import { localized } from "../lib/locale";
import { ago } from "../lib/feed";
import { t } from "../lib/locale";

/* 뉴스 — 출처가 있는 것만 싣는다. 요약은 우리가 쓰되 숫자는 원문 그대로 옮기고
   원문 링크를 같이 낸다. 출처 없는 업계 소식은 소문이지 뉴스가 아니다. */

const TAGS = ["전체", "시장", "기술", "정책", "도구"] as const;

export function News() {
  const [tag, setTag] = useState<(typeof TAGS)[number]>("전체");
  const list = useMemo(
    () => (tag === "전체" ? NEWS : NEWS.filter((n) => n.tag === tag)),
    [tag],
  );

  return (
    <main className="mx-auto max-w-[840px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">{t("커뮤니티")}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{t("업계 뉴스")}</h1>
        <p className="mt-2 text-xs text-muted">{t("출처가 확인된 소식만 싣고 원문을 함께 답니다.")}</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-line pb-4">
        {TAGS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTag(k)}
            aria-pressed={tag === k}
            className={[
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
              tag === k
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {t(k)}
            <span className={tag === k ? "ml-1.5 opacity-60" : "ml-1.5 text-faint"}>
              {k === "전체" ? NEWS.length : NEWS.filter((n) => n.tag === k).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {list.map((n) => (
          <Row key={n.id} item={n} />
        ))}
      </div>
    </main>
  );
}

function Row({ item: base }: { item: Item }) {
  // 레코드를 지금 언어로 겹쳐 읽는다. 안 옮긴 필드는 한국어가 남는다.
  const item = localized(NEWS_EN, base.id, base);
  return (
    <article className="grid gap-x-8 gap-y-3 border-b border-line py-6 sm:grid-cols-[minmax(0,1fr)_140px]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="text-accent">{t(item.tag)}</span>
          <span>{ago(Date.now() - item.daysAgo * 86_400_000)}</span>
        </p>
        <h2 className="mt-1.5 text-base leading-snug font-bold text-ink">{item.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">{item.body}</p>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2.5 inline-block text-xs text-faint no-underline hover:text-accent"
        >
          {item.source}
        </a>
      </div>

      {/* 인용 수치를 따로 세운다. 목록을 훑을 때 이것만 봐도 무슨 소식인지 안다. */}
      {item.figure && (
        <div className="sm:border-l sm:border-line sm:pl-5">
          <p className="num text-2xl leading-none text-ink">{item.figure.value}</p>
          <p className="mt-1 text-xs text-faint">{item.figure.label}</p>
        </div>
      )}
    </article>
  );
}
