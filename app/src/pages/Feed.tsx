import { useState } from "react";
import { Link } from "react-router-dom";
import { useFeed, ago, type Post, type Author } from "../lib/feed";
import { PIECES } from "../data/pieces";
import { KNOB_LABEL, type Knobs } from "../data/concepts";
import { Thumb } from "../components/Thumb";

/* 공략집 — 게시판도 아니고 프리셋 목록도 아니다.
   숫자 아홉 개만 있으면 남이 자기 상황에 대입할 수 없다. 무엇을 하려다
   어디서 막혔고 어떤 순서로 풀었는지가 있어야 공략이 된다.

   스튜디오에서 작업을 끝내면 그 세 칸이 자동으로 채워진다. 빈 글쓰기 칸은 없다.
   공개 지표는 적용 수 하나뿐이다 — 사람이 아니라 물건에 점수를 붙인다. */

type Sort = "new" | "forks" | "drop";

const SORTS: [Sort, string][] = [
  ["new", "최신"],
  ["forks", "많이 따라한 순"],
  ["drop", "실패 사례"],
];

export function Feed() {
  const { list } = useFeed();
  const [sort, setSort] = useState<Sort>("forks");

  const sorted = [...list].sort((a, b) =>
    sort === "new" ? b.at - a.at
    : sort === "forks" ? b.forks - a.forks
    : a.after - a.before - (b.after - b.before),
  );

  return (
    <main className="mx-auto max-w-[840px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">작업물</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">공략집</h1>
        <p className="mt-2 text-xs text-muted">어디서 막혔고 어떤 순서로 풀었는지, 쓴 설정까지 그대로 공개합니다.</p>
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <FeedSpec k="공개" v="상황, 문제, 순서, 파라미터 9개" />
          <FeedSpec k="따라하기" v="설정을 들고 스튜디오로 이동" />
          <FeedSpec k="댓글" v="익명, 소속만 인증" />
        </dl>
      </header>

      <div className="mb-5 flex items-center gap-1.5 border-b border-line pb-3">
        {SORTS.map(([k, name]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSort(k)}
            aria-pressed={sort === k}
            className={[
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
              sort === k
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {name}
          </button>
        ))}
        <Link
          to="/workshop"
          className="ml-auto rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white no-underline hover:bg-accent-strong"
        >
          스튜디오에서 만들기
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {sorted.map((p) => (
          <Card key={p.id} post={p} />
        ))}
      </div>
    </main>
  );
}

function Card({ post }: { post: Post }) {
  const { comment } = useFeed();
  const piece = PIECES.find((x) => x.id === post.pieceId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [anon, setAnon] = useState(true);

  const diff = post.after - post.before;

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const by: Author = anon ? { name: "익명" } : { name: "익명", studio: "국내 모바일 게임사", verified: true };
    comment(post.id, body, by);
    setDraft("");
  };

  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex gap-4">
        {piece && (
          <Link to={`/market/${piece.id}`} className="relative block aspect-square w-20 flex-none rounded-lg bg-surface-2">
            <Thumb piece={piece} />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-snug font-bold text-ink">{post.title}</h2>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
            <Byline by={post.by} />
            <span>{ago(post.at)}</span>
            {post.seeded && <span className="rounded border border-line px-1.5 py-px">운영자 작성</span>}
          </p>

          {/* 상황과 문제를 먼저 낸다. 남이 자기 경우인지 여기서 판단한다. */}
          <dl className="mt-3 flex flex-col gap-1.5">
            <div className="flex gap-2.5">
              <dt className="w-9 shrink-0 text-xs text-faint">상황</dt>
              <dd className="m-0 text-xs leading-relaxed text-muted">{post.situation}</dd>
            </div>
            <div className="flex gap-2.5">
              <dt className="w-9 shrink-0 text-xs text-faint">문제</dt>
              <dd className="m-0 text-xs leading-relaxed text-muted">{post.problem}</dd>
            </div>
          </dl>

          <ol className="mt-3 flex list-none flex-col gap-1.5 p-0">
            {(post.steps ?? []).map((st, i) => (
              <li key={st} className="flex gap-2.5 text-xs">
                <span className="num w-9 shrink-0 text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-muted">{st}</span>
              </li>
            ))}
          </ol>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="text-faint">
              분석 <b className="tabular-nums text-muted line-through">{post.before}</b>{" "}
              <b className={`tabular-nums ${diff >= 0 ? "text-accent" : "text-[#FF6B7A]"}`}>
                {post.after} ({diff >= 0 ? `+${diff}` : diff})
              </b>
            </span>
            <span className="text-faint">
              <b className="tabular-nums text-ink">{post.forks}</b>명이 따라함
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/workshop?fork=${post.id}`}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white no-underline hover:bg-accent-strong"
            >
              이대로 따라하기
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="cursor-pointer rounded-lg border border-line bg-transparent px-3.5 py-1.5 text-xs text-muted hover:text-ink"
            >
              댓글 {post.comments.length}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <Knoblist knobs={post.knobs} />

          <div className="mt-4 flex flex-col gap-3">
            {post.comments.map((c) => (
              <div key={c.id}>
                <p className="flex items-center gap-2 text-xs text-faint">
                  <Byline by={c.by} />
                  <span>{ago(c.at)}</span>
                </p>
                <p className="mt-1 text-base leading-relaxed text-muted">{c.body}</p>
              </div>
            ))}
            {post.comments.length === 0 && <p className="text-xs text-faint">아직 댓글이 없습니다.</p>}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="따라해 보고 어땠는지"
              aria-label="댓글"
              className="min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 py-2.5 text-xs text-ink placeholder:text-faint"
            />
            <button
              type="button"
              onClick={send}
              className="cursor-pointer rounded-lg border-0 bg-accent px-4 py-2.5 text-xs font-bold text-white"
            >
              남기기
            </button>
          </div>
          {/* 실명으로는 실무 얘기가 안 나온다. 소속만 인증하고 신원은 가린다. */}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-faint">
            <input type="checkbox" checked={!anon} onChange={(e) => setAnon(!e.target.checked)} className="accent-[var(--accent)]" />
            소속만 밝히기
          </label>
        </div>
      )}
    </article>
  );
}

function FeedSpec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 text-xs font-semibold text-ink">{v}</dd>
    </div>
  );
}

function Byline({ by }: { by: Author }) {
  return (
    <span className="flex items-center gap-1.5">
      <b className="font-semibold text-muted">{by.name}</b>
      {by.studio && (
        <span className="rounded border border-line px-1.5 py-px text-[10px] text-faint">
          {by.studio}
          {by.verified && " 인증"}
        </span>
      )}
    </span>
  );
}

function Knoblist({ knobs }: { knobs: Knobs }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
      {(Object.keys(KNOB_LABEL) as (keyof Knobs)[]).map((k) => (
        <div key={k} className="flex items-center justify-between gap-2">
          <dt className="text-xs text-faint">{KNOB_LABEL[k][0]}</dt>
          <dd className="m-0 flex flex-1 items-center gap-2">
            <span className="block h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
              <b className="block h-full bg-accent" style={{ width: `${knobs[k]}%` }} />
            </span>
            <span className="w-6 text-right text-xs tabular-nums text-muted">{knobs[k]}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
