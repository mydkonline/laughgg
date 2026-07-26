import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { PIECES } from "../data/pieces";
import {
  CONCEPTS,
  NEUTRAL,
  KNOB_LABEL,
  knobsFromPrompt,
  matchedAxes,
  scoreDelta,
  type Knobs,
} from "../data/concepts";
import { useCart } from "../lib/cart";
import { useFeed } from "../lib/feed";
import { Preview } from "../three/Preview";
import { Thumb } from "../components/Thumb";
import { RankIcon, badgeOf, BADGE_LABEL } from "../components/Rank";

/* 공방 — 이 사이트가 하는 일 중 제일 중요한 것.
   만드는 능력은 흔해진다. 남는 건 가진 에셋을 이 게임의 느낌으로 가져오는 능력이다.

   들어오는 문은 셋이다: 프리셋 · 프롬프트 · 슬라이더. 셋 다 같은 여섯 숫자로
   모이고, 그 숫자가 실제 렌더와 검수 점수를 동시에 움직인다. */

export function Workshop() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { ids: cartIds } = useCart();
  const { list, publish, fork } = useFeed();

  /* 장바구니에 담은 것부터 보여준다. 비어 있으면 마켓 상위로 채운다 —
     빈 작업대를 열면 아무것도 시작되지 않는다. */
  const pool = useMemo(() => {
    const inCart = PIECES.filter((p) => cartIds.includes(p.id) && p.m);
    return inCart.length ? inCart : PIECES.filter((p) => p.m).slice(0, 8);
  }, [cartIds]);

  const [pieceId, setPieceId] = useState(() => Number(params.get("piece")) || pool[0]?.id || 1);
  const piece = PIECES.find((p) => p.id === pieceId) ?? pool[0];

  const [conceptId, setConceptId] = useState(params.get("concept") ?? "dark");
  const [prompt, setPrompt] = useState("");
  const [knobs, setKnobs] = useState<Knobs>(
    () => CONCEPTS.find((c) => c.id === (params.get("concept") ?? "dark"))?.knobs ?? NEUTRAL,
  );
  const [published, setPublished] = useState<string | null>(null);

  /* 피드에서 포크해 들어온 경우 — 그 레시피를 그대로 작업대에 올린다.
     구경이 곧 시도가 되는 지점이라 이 경로가 제일 중요하다. */
  const forkFrom = params.get("fork");
  useEffect(() => {
    if (!forkFrom) return;
    const src = list.find((p) => p.id === forkFrom);
    if (!src) return;
    setPieceId(src.pieceId);
    setKnobs(src.knobs);
    setPrompt(src.prompt);
    setConceptId("custom");
    fork(src.id);
    setParams({}, { replace: true });
  }, [forkFrom, list, fork, setParams]);

  const applyConcept = (id: string) => {
    const c = CONCEPTS.find((x) => x.id === id);
    if (!c) return;
    setConceptId(id);
    setKnobs(c.knobs);
  };

  const applyPrompt = () => {
    if (!prompt.trim()) return;
    setKnobs(knobsFromPrompt(prompt, knobs));
    setConceptId("custom");
  };

  const setKnob = (k: keyof Knobs, v: number) => {
    setKnobs((prev) => ({ ...prev, [k]: v }));
    setConceptId("custom");
  };

  if (!piece?.m) {
    return <p className="mx-auto max-w-[760px] px-5 py-24 text-base text-muted">불러올 모델이 없습니다.</p>;
  }

  const delta = scoreDelta(knobs);
  const after = Math.max(31, Math.min(99, piece.score + Math.round((delta.런타임 + delta.면구성 + delta.텍스처) / 2)));
  const hits = matchedAxes(prompt);
  const conceptName = CONCEPTS.find((c) => c.id === conceptId)?.name ?? "직접 조정";

  const onPublish = () => {
    const id = publish({
      pieceId: piece.id,
      title: `${piece.t} 를 ${conceptName} 톤으로`,
      concept: conceptName,
      prompt: prompt.trim() || "슬라이더로 직접 조정",
      knobs,
      before: piece.score,
      after,
      by: { name: "익명" },
    });
    setPublished(id);
  };

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">공방</p>
        <h1 className="mt-1 max-w-[22ch] text-4xl leading-tight font-bold text-ink">
          가진 에셋을 이 게임의 느낌으로 가져옵니다
        </h1>
        <p className="mt-3 max-w-[52ch] text-base text-muted">
          만드는 일은 곧 흔해집니다. 남는 건 <b className="text-ink">이미 있는 것을 이 게임에 맞추는 능력</b>입니다.
          2D든 3D든, 컨셉을 고르거나 말로 쓰면 그 자리에서 바뀌고 검수가 다시 붙습니다.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* 작업대 */}
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Frame label="원본">
              <Preview model={piece.m} knobs={NEUTRAL} className="h-full w-full" />
            </Frame>
            <Frame label={conceptName} accent>
              <Preview model={piece.m} knobs={knobs} className="h-full w-full" />
            </Frame>
          </div>

          {/* 재료 — 장바구니에 담은 것부터 */}
          <div className="mt-6">
            <p className="mb-2 text-xs text-faint">
              {cartIds.length ? "장바구니에 담은 에셋" : "장바구니가 비어 있어 마켓 상위를 올려 뒀습니다"}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pool.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPieceId(p.id)}
                  aria-pressed={p.id === piece.id}
                  className={[
                    "w-24 flex-none cursor-pointer overflow-hidden rounded-lg border bg-surface p-1.5",
                    p.id === piece.id ? "border-accent" : "border-line hover:border-chrome-600",
                  ].join(" ")}
                >
                  <span className="block aspect-square">
                    <Thumb piece={p} />
                  </span>
                  <span className="block truncate pt-1 text-[10px] text-faint">{p.t}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 조작 */}
        <aside className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2.5 text-base font-bold text-ink">게임 컨셉</h2>
            <div className="flex flex-wrap gap-1.5">
              {CONCEPTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyConcept(c.id)}
                  aria-pressed={conceptId === c.id}
                  title={c.note}
                  className={[
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs",
                    conceptId === c.id
                      ? "border-transparent bg-ink font-bold text-ground"
                      : "border-line text-muted hover:border-accent hover:text-ink",
                  ].join(" ")}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-[2.6em] text-xs leading-relaxed text-faint">
              {CONCEPTS.find((c) => c.id === conceptId)?.note ?? "슬라이더로 직접 맞춘 상태입니다."}
            </p>
          </section>

          <section>
            <h2 className="mb-2.5 text-base font-bold text-ink">말로 쓰기</h2>
            <div className="flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyPrompt()}
                placeholder="어둡고 축축한 지하, 금속만 반사"
                aria-label="변형 프롬프트"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-faint"
              />
              <button
                type="button"
                onClick={applyPrompt}
                className="cursor-pointer rounded-lg border-0 bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-accent-strong"
              >
                적용
              </button>
            </div>
            <p className="mt-2 text-xs text-faint">
              {hits.length ? (
                <>읽어낸 축 — {hits.map((h) => KNOB_LABEL[h][0]).join(" · ")}</>
              ) : (
                "어둡게 · 따뜻하게 · 금속 · 로우폴리 · 만화 · 빛바랜 같은 말을 읽습니다."
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-2.5 text-base font-bold text-ink">직접 조정</h2>
            <div className="flex flex-col gap-2.5">
              {(Object.keys(KNOB_LABEL) as (keyof Knobs)[]).map((k) => (
                <label key={k} className="grid grid-cols-[54px_minmax(0,1fr)_92px] items-center gap-3">
                  <span className="text-xs font-semibold text-ink">{KNOB_LABEL[k][0]}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={knobs[k]}
                    onChange={(e) => setKnob(k, +e.target.value)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-right text-xs text-faint">{KNOB_LABEL[k][1]}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 결과 — 자랑도 실패도 같은 자리에 나온다 */}
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-faint">검수</span>
              <b className="text-2xl tabular-nums text-faint line-through">{piece.score}</b>
              <b className="text-4xl font-bold tabular-nums text-ink">{after}</b>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-extrabold text-accent">
                <RankIcon badge={badgeOf(after)} size={14} />
                {BADGE_LABEL[badgeOf(after)]}
              </span>
            </div>
            <dl className="mt-3 flex flex-col gap-1.5">
              {Object.entries(delta).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <dt className="text-muted">{k}</dt>
                  <dd className={`m-0 tabular-nums ${v > 0 ? "text-accent" : v < 0 ? "text-[#FF6B7A]" : "text-faint"}`}>
                    {v > 0 ? `+${v}` : v}
                  </dd>
                </div>
              ))}
            </dl>

            {published ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/feed")}
                  className="flex-1 cursor-pointer rounded-lg border-0 bg-accent px-4 py-2.5 text-xs font-bold text-white"
                >
                  피드에서 보기
                </button>
                <button
                  type="button"
                  onClick={() => setPublished(null)}
                  className="cursor-pointer rounded-lg border border-line bg-transparent px-4 py-2.5 text-xs text-muted"
                >
                  더 만지기
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onPublish}
                className="mt-4 w-full cursor-pointer rounded-lg border-0 bg-accent px-4 py-3 text-base font-bold text-white hover:bg-accent-strong"
              >
                레시피로 올리기
              </button>
            )}
            <p className="mt-2 text-xs leading-relaxed text-faint">
              올리면 프롬프트와 슬라이더 값이 같이 공개됩니다. 다른 사람이 자기 에셋에 그대로 돌려 볼 수 있습니다.
            </p>
          </section>

          <Link to="/feed" className="text-xs text-faint no-underline hover:text-ink">
            다른 사람 작업물 보기 →
          </Link>
        </aside>
      </div>

      <p className="mt-14 max-w-[62ch] text-xs leading-relaxed text-faint">
        <b className="text-muted">시연용 데모입니다.</b> 조명·재질·면 처리·외곽선은 실제로 렌더를 바꾸지만,
        프롬프트 해석은 지금 키워드 규칙이고 생성 엔진이 붙어 있지 않습니다. 점수 변화는 셰이더 비용과
        면 수에서 계산한 값입니다.
      </p>
    </main>
  );
}

function Frame({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      <div
        className={[
          "relative aspect-[4/3] overflow-hidden rounded-xl border bg-gradient-to-b from-surface-2 to-surface",
          accent ? "border-accent" : "border-line",
        ].join(" ")}
      >
        {children}
      </div>
      <figcaption className={`pt-2 text-xs ${accent ? "font-bold text-ink" : "text-faint"}`}>{label}</figcaption>
    </figure>
  );
}
