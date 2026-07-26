import { useState } from "react";
import { ARTICLES, type Article } from "../data/news";
import { ago } from "../lib/feed";

/* 기사 — 우리가 쓴 분석이다. 남의 이름을 빌리지 않는다.
   목록에서 펼쳐 읽는다. 별도 주소로 나누기엔 편수가 적고, 나누면 왕복만 늘어난다. */

export function Articles() {
  const [open, setOpen] = useState<string | null>(ARTICLES[0]?.id ?? null);

  return (
    <main className="mx-auto max-w-[760px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">커뮤니티</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">기사</h1>
        <p className="mt-2 text-xs text-muted">기준을 정한 이유와 접은 안을 남깁니다.</p>
      </header>

      <div className="flex flex-col">
        {ARTICLES.map((a) => (
          <Piece key={a.id} a={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} />
        ))}
      </div>
    </main>
  );
}

function Piece({ a, open, onToggle }: { a: Article; open: boolean; onToggle: () => void }) {
  return (
    <article className="border-b border-line py-6">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full cursor-pointer text-left">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="text-accent">{a.kind}</span>
          <span>{ago(Date.now() - a.daysAgo * 86_400_000)}</span>
          <span>{a.minutes}분</span>
        </p>
        <h2 className="mt-1.5 text-base leading-snug font-bold text-ink">{a.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">{a.lead}</p>
      </button>

      {open && (
        <div className="mt-6 flex flex-col gap-5 border-t border-line pt-5">
          {a.body.map(([h, p]) => (
            <section key={h}>
              <h3 className="text-xs font-bold text-ink">{h}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{p}</p>
            </section>
          ))}
          <p className="text-xs text-faint">LaughGG 편집</p>
        </div>
      )}
    </article>
  );
}
