import { useState } from "react";
import { EPISODES, type Episode } from "../data/episodes";
import { PIECES, modelSrc } from "../data/pieces";
import { Preview } from "../three/Preview";
import { NEUTRAL, CONCEPTS } from "../data/concepts";
import { RankIcon, type BadgeKey } from "../components/Rank";

/* 개발 브이로그 — 에셋 하나가 완성되기까지를 단계별로 남긴다.
   결과물만 보면 왜 그렇게 만들었는지 알 수 없고, 사는 쪽도 판단이 안 선다. */

/* 브이로그의 모델 이름은 마켓 상품 키와 다르다. 단계별로 보여줄 상품을 붙여 둔다. */
const STAGE_PIECE: Record<string, string> = {
  column: "gothic_statue",
  "weapon-sword": "kite_shield",
};

/* 단계마다 렌더 톤을 바꿔 진행이 눈에 보이게 한다. */
const STAGE_NAME: Record<string, string> = {
  wire: "블록아웃",
  flat: "하이폴리",
  retopo: "리토폴로지",
  tex: "텍스처",
  lod: "LOD",
};

const STAGE_LOOK: Record<string, string> = {
  wire: "one",
  flat: "ink",
  retopo: "toon",
  tex: "high",
  lod: "dark",
};

export function Vlog() {
  const [cur, setCur] = useState(0);
  const ep = EPISODES[cur] ?? EPISODES[0]!;

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">개발 브이로그</p>
        <h1 className="mt-1 text-4xl font-bold text-ink">에셋 하나가 완성되기까지</h1>
        <p className="mt-2 text-base text-muted">
          블록아웃부터 검수 통과까지 단계마다 무엇을 왜 했는지 남깁니다. 사는 쪽이 판단할 근거가 됩니다.
        </p>
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-4">
          <Stat k="기록한 단계" v={`${EPISODES.length}편`} />
          <Stat k="기간" v={`${EPISODES[0]?.date ?? ""} 부터`} />
          <Stat k="최종 결과" v={EPISODES.at(-1)?.grade ? `${EPISODES.at(-1)!.grade![0]} ${EPISODES.at(-1)!.grade![2]}점` : "진행 중"} />
        </dl>
      </header>

      {/* 진행 막대 겸 목차 */}
      <nav className="mb-6 flex gap-px overflow-hidden rounded-lg border border-line bg-line">
        {EPISODES.map((e, i) => (
          <button
            key={e.no}
            type="button"
            onClick={() => setCur(i)}
            aria-current={i === cur}
            className={[
              "flex-1 cursor-pointer px-2 py-2.5 text-center text-xs",
              i === cur ? "bg-accent font-bold text-white" : "bg-surface text-faint hover:text-ink",
            ].join(" ")}
          >
            {e.day}
          </button>
        ))}
      </nav>

      <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <EpisodeShot ep={ep} />

        <div>
          <p className="text-xs text-faint">
            {ep.day}, {ep.date}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">{ep.t}</h2>
          <p className="mt-1 text-xs text-faint">{ep.cap}</p>

          <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted">{ep.body}</p>

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
            {ep.delta.map(([k, v, dir]) => (
              <div key={k}>
                <dt className="text-xs text-faint">{k}</dt>
                <dd className={`m-0 text-2xl font-bold tabular-nums ${dir === "up" ? "text-accent" : "text-ink"}`}>{v}</dd>
              </div>
            ))}
          </dl>

          {ep.grade && (
            <div className="mt-5 flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 w-fit">
              <RankIcon badge={ep.grade[1] as BadgeKey} size={18} />
              <b className="text-base font-extrabold text-accent">
                {ep.grade[0]} {ep.grade[2]}
              </b>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-4 border-t border-line pt-5">
            {ep.qa.map(([q, a]) => (
              <div key={q}>
                <p className="text-base font-bold text-ink">{q}</p>
                <p className="mt-1 max-w-[62ch] text-base leading-relaxed text-muted">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <div className="mt-10 flex justify-between border-t border-line pt-6">
        <button
          type="button"
          disabled={cur === 0}
          onClick={() => setCur((i) => i - 1)}
          className="cursor-pointer rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전 편
        </button>
        <button
          type="button"
          disabled={cur === EPISODES.length - 1}
          onClick={() => setCur((i) => i + 1)}
          className="cursor-pointer rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 편
        </button>
      </div>
    </main>
  );
}

function EpisodeShot({ ep }: { ep: Episode }) {
  const key = STAGE_PIECE[ep.model] ?? "gothic_statue";
  const piece = PIECES.find((p) => p.m === key);
  const src = piece ? modelSrc(piece) : null;
  const look = CONCEPTS.find((c) => c.id === (STAGE_LOOK[ep.stage] ?? "real"));

  return (
    <figure className="m-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-gradient-to-b from-surface-2 to-surface">
        {src && <Preview model={src} knobs={look?.knobs ?? NEUTRAL} className="h-full w-full" />}
      </div>
      <figcaption className="pt-2 text-xs text-faint">{STAGE_NAME[ep.stage] ?? ep.stage} 단계</figcaption>
    </figure>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 text-base font-semibold text-ink">{v}</dd>
    </div>
  );
}
