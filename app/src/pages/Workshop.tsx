import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PIECES, isModel, modelSrc } from "../data/pieces";
import {
  CONCEPTS,
  NEUTRAL,
  NEUTRAL_RASTER,
  KNOB_LABEL,
  knobsFromPrompt,
  rasterFromPrompt,
  promptWantsSprite,
  scoreDelta,
  type Knobs,
  type RasterSet,
} from "../data/concepts";
import { PALETTES } from "../data/palettes";
import { useCart } from "../lib/cart";
import { useUploads } from "../lib/uploads";
import { PromptBuilder, toPrompt } from "../components/PromptBuilder";
import { useCredit } from "../lib/credit";
import { useFeed } from "../lib/feed";
import { Preview } from "../three/Preview";
import { Sprite } from "../three/Sprite";
import { Thumb } from "../components/Thumb";
import { RankIcon, badgeOf, BADGE_LABEL } from "../components/Rank";

/* 스튜디오 — 가진 에셋을 이 게임의 느낌으로 가져오는 자리.

   들어오는 문은 셋(프롬프트·컨셉·손조작)인데 도착지는 하나다:
   Knobs 여섯 개 + RasterSet 셋. 이 아홉 숫자가 유일한 상태라서 결과가 재현되고
   통째로 남에게 넘어간다.

   화면은 프롬프트를 맨 위에 둔다. 대부분은 말로 쓰고 끝내고, 손조작은
   그다음에 다듬는 사람만 연다. */

export function Workshop() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { ids: cartIds } = useCart();
  const { list, publish, fork } = useFeed();
  const { list: mine, add: addFiles, remove: dropFile } = useUploads();
  const { remaining, free, spend } = useCredit();

  /* 올린 파일이 맨 앞이다. 자기 것부터 보여야 남의 마켓이 아니라 내 작업대로 읽힌다. */
  const pool = useMemo(() => {
    const inCart = PIECES.filter((p) => cartIds.includes(p.id));
    return [...mine, ...(inCart.length ? inCart : PIECES.slice(0, 12))];
  }, [cartIds, mine]);

  const [pieceId, setPieceId] = useState(() => Number(params.get("piece")) || pool[0]?.id || 1);
  const piece = pool.find((p) => p.id === pieceId) ?? PIECES.find((p) => p.id === pieceId) ?? pool[0];

  const [conceptId, setConceptId] = useState("dark");
  const [prompt, setPrompt] = useState("");
  /* 블록으로 조립해도 결과는 같은 문자열이라 해석기를 그대로 탄다. */
  const [blocks, setBlocks] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [knobs, setKnobs] = useState<Knobs>(() => CONCEPTS[0]!.knobs);
  const [raster, setRaster] = useState<RasterSet>(() => CONCEPTS[0]!.raster);
  const [asSprite, setAsSprite] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  /* 피드에서 포크해 들어온 경우 — 그 프리셋을 그대로 작업대에 올린다.
     구경이 곧 시도가 되는 지점이라 이 경로가 제일 중요하다. */
  const forkFrom = params.get("fork");
  useEffect(() => {
    if (!forkFrom) return;
    const src = list.find((p) => p.id === forkFrom);
    if (!src) return;
    setPieceId(src.pieceId);
    setKnobs(src.knobs);
    if (src.raster) {
      setRaster(src.raster);
      setAsSprite(true);
    }
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
    setRaster(c.raster);
  };

  /* 프롬프트 한 줄이 노브와 2D 설정을 동시에 정한다.
     "게임보이 느낌" 이라고 썼는데 색이 안 바뀌면 읽었다고 할 수 없다. */
  const applyPrompt = () => {
    const text = prompt.trim();
    if (!text) return;
    if (!spend()) return;
    setKnobs(knobsFromPrompt(text, knobs));
    setRaster(rasterFromPrompt(text, raster));
    if (promptWantsSprite(text)) setAsSprite(true);
    setConceptId("custom");
  };

  if (!piece) {
    return <p className="mx-auto max-w-[760px] px-5 py-24 text-base text-muted">불러올 에셋이 없습니다.</p>;
  }

  const spriteOnly = !isModel(piece);
  const sprite = asSprite || spriteOnly;
  const delta = scoreDelta(knobs);
  const after = Math.max(31, Math.min(99, piece.score + Math.round((delta.런타임 + delta.면구성 + delta.텍스처) / 2)));
  const conceptName = CONCEPTS.find((c) => c.id === conceptId)?.name ?? "직접 조정";
  const palette = PALETTES.find((p) => p.id === raster.palette);

  const onPublish = () => {
    const id = publish({
      pieceId: piece.id,
      title: `${piece.t} 를 ${conceptName} 톤으로`,
      /* 올릴 때 상황을 자동으로 채운다. 빈 칸을 내밀면 아무도 안 쓴다.
         나중에 본인이 고칠 수 있게 두는 게 맞지만, 시작은 채워 준다. */
      situation: `${piece.t} 를 ${conceptName} 프로젝트에 넣어야 했습니다.`,
      problem: sprite
        ? "원본 그대로 넣으면 팔레트가 달라 기존 화면에서 튑니다."
        : "원본 그대로 넣으면 조명과 재질이 달라 배경과 따로 놉니다.",
      steps: [
        prompt.trim() ? `프롬프트로 방향을 잡는다: ${prompt.trim()}` : `컨셉을 ${conceptName} 으로 고른다`,
        sprite ? `팔레트를 ${palette?.name ?? "자유"} 로 고정하고 도트 굵기를 ${raster.pixel} 로 둔다` : "조명과 재질을 컨셉값으로 맞춘다",
        `검수 ${piece.score} 에서 ${after} 로 바뀐 것을 확인한다`,
      ],
      concept: conceptName,
      prompt: prompt.trim() || "프리셋 컨셉 적용",
      knobs,
      raster: sprite ? raster : undefined,
      before: piece.score,
      after,
      by: { name: "익명" },
    });
    setPublished(id);
  };

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20">
      <header className="py-8">
        <p className="text-xs tracking-wide text-accent">스튜디오</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">에셋 컨셉 변환</h1>
        <p className="mt-2 text-xs text-muted">3D 는 조명과 재질, 2D 는 팔레트와 도트를 바꿉니다.</p>
      </header>

      {/* 1 — 무엇을 만질지 고른다 */}
      <section
        className={[
          "mt-6 rounded-xl border border-dashed p-3 transition-colors",
          dropping ? "border-accent bg-accent-soft" : "border-line",
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          const added = addFiles(e.dataTransfer.files);
          if (added[0]) setPieceId(added[0].id);
        }}
      >
        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-ink">재료</span>
          <span className="text-xs text-faint">
            {mine.length ? `내 파일 ${mine.length}개` : cartIds.length ? "장바구니에 담은 에셋" : "마켓 상위"}
          </span>
          <label className="ml-auto cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-ink">
            내 파일 올리기
            <input
              type="file"
              multiple
              accept=".glb,.gltf,image/*"
              className="hidden"
              onChange={(e) => {
                const added = addFiles(e.target.files ?? []);
                if (added[0]) setPieceId(added[0].id);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {pool.map((p) => (
            <div key={p.id} className="relative w-24 flex-none">
              <button
                type="button"
                onClick={() => setPieceId(p.id)}
                aria-pressed={p.id === piece.id}
                className={[
                  "w-full cursor-pointer overflow-hidden rounded-lg border bg-surface p-1.5",
                  p.id === piece.id ? "border-accent" : "border-line hover:border-chrome-600",
                ].join(" ")}
              >
                <span className="relative block aspect-square">
                  <Thumb piece={p} pad="8%" />
                </span>
                <span className="block truncate pt-1 text-[10px] text-faint">{p.t}</span>
              </button>
              {p.url && (
                <button
                  type="button"
                  aria-label={`${p.t} 빼기`}
                  onClick={() => {
                    dropFile(p.id);
                    if (p.id === piece.id) setPieceId(PIECES[0]!.id);
                  }}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 cursor-pointer rounded-full border border-line bg-ground text-[10px] text-faint hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-faint">glb, gltf, png, jpg. 파일은 브라우저에만 남습니다.</p>
      </section>
      {/* 2 — 결과. 조작을 그림 위에 두면 보면서 못 만진다. 그림이 먼저고,
          원본과 나란히 두지 않으면 무엇이 달라졌는지 안 보인다. */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Frame label="원본">
            {sprite ? (
              <Sprite piece={piece} knobs={NEUTRAL} raster={NEUTRAL_RASTER} />
            ) : (
              <Preview model={modelSrc(piece)!} knobs={NEUTRAL} className="h-full w-full" />
            )}
          </Frame>
          <Frame label={`${conceptName}${sprite ? ` (${palette?.name ?? "스프라이트"})` : ""}`} accent>
            {sprite ? (
              <Sprite piece={piece} knobs={knobs} raster={raster} />
            ) : (
              <Preview model={modelSrc(piece)!} knobs={knobs} className="h-full w-full" />
            )}
          </Frame>
        </div>

        {/* 검수 결과 — 자랑도 실패도 같은 자리에 나온다 */}
        <aside className="flex flex-col rounded-xl border border-line bg-surface p-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs text-faint">분석</span>
            <b className="text-base tabular-nums text-faint line-through">{piece.score}</b>
            <b className="num text-4xl text-ink">{after}</b>
          </div>
          <span className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-extrabold text-accent">
            <RankIcon badge={badgeOf(after)} size={14} />
            {BADGE_LABEL[badgeOf(after)]}
          </span>

          <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
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
            <div className="mt-auto flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => navigate("/feed")}
                className="flex-1 cursor-pointer rounded-lg border-0 bg-accent px-3 py-2.5 text-xs font-bold text-white"
              >
                피드에서 보기
              </button>
              <button
                type="button"
                onClick={() => setPublished(null)}
                className="cursor-pointer rounded-lg border border-line bg-transparent px-3 py-2.5 text-xs text-muted"
              >
                더 만지기
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              className="mt-auto w-full cursor-pointer rounded-lg border-0 bg-accent px-4 py-3 pt-3 text-base font-bold text-white hover:bg-accent-strong"
            >
              프리셋으로 올리기
            </button>
          )}
        </aside>
      </section>

      {/* 3 — 프롬프트를 조립한다. 빈 입력창은 무엇을 쓸 수 있는지 알려 주지 않는다. */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-xs font-bold text-ink">프롬프트</h2>
          <button
            type="button"
            onClick={() => setTyping((v) => !v)}
            className="cursor-pointer border-0 bg-transparent text-xs text-faint hover:text-ink"
          >
            {typing ? "블록으로 조립" : "직접 입력"}
          </button>
          {/* 무료 횟수를 넘긴 요청만 과금하는 게 수익 구조라 화면에서도 그렇게 보여야 한다. */}
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-faint">
              크레딧 <b className="num text-ink">{remaining}</b> / {free}
            </span>
            <button
              type="button"
              onClick={applyPrompt}
              disabled={remaining < 1 || !prompt.trim()}
              className="cursor-pointer rounded-lg border-0 bg-accent px-5 py-2 text-xs font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              적용 <span className="opacity-70">1 크레딧</span>
            </button>
          </span>
        </div>

        {typing ? (
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrompt()}
            placeholder="어둡고 축축한 던전, 게임보이 초록 4색, 굵은 도트"
            aria-label="변형 프롬프트"
            className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint"
          />
        ) : (
          <PromptBuilder
            picked={blocks}
            onChange={(next) => {
              setBlocks(next);
              setPrompt(toPrompt(next));
            }}
          />
        )}

        {prompt && (
          <p className="mt-2.5 rounded-lg bg-surface px-3 py-2 font-mono text-xs text-muted">{prompt}</p>
        )}
        {remaining < 1 && (
          <p className="mt-2 text-xs text-[#FF6B7A]">무료 크레딧을 다 썼습니다. 컨셉 프리셋과 직접 조정은 계속 무료입니다.</p>
        )}
      </section>

      {/* 4 — 골라도 된다 */}
      <section className="mt-6">
        <div className="mb-2.5 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xs font-bold text-ink">게임 컨셉</h2>
          <p className="text-xs text-faint">{CONCEPTS.find((c) => c.id === conceptId)?.note ?? "파라미터를 직접 조정한 상태입니다."}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CONCEPTS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => applyConcept(c.id)}
              aria-pressed={conceptId === c.id}
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
      </section>

      {/* 5 — 형식과 2D 설정. 가로로 편다. */}
      <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-line bg-surface px-4 py-3.5">
        <Field label="출력 형식">
          <div className="flex gap-1.5">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                disabled={spriteOnly && !v}
                onClick={() => setAsSprite(v)}
                aria-pressed={sprite === v}
                className={[
                  "cursor-pointer rounded-full border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40",
                  sprite === v
                    ? "border-transparent bg-ink font-bold text-ground"
                    : "border-line text-muted hover:border-accent hover:text-ink",
                ].join(" ")}
              >
                {v ? "2D 스프라이트" : "3D 모델"}
              </button>
            ))}
          </div>
        </Field>

        {sprite && (
          <>
            <Field label="팔레트" hint={palette?.from}>
              <select
                value={raster.palette}
                onChange={(e) => {
                  setRaster((r) => ({ ...r, palette: e.target.value }));
                  setConceptId("custom");
                }}
                className="rounded-lg border border-line bg-ground px-3 py-1.5 text-xs text-ink"
              >
                {PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            {palette && palette.colors.length > 0 && (
              <Field label="쓰는 색">
                <div className="flex gap-1">
                  {palette.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      style={{ background: c }}
                      className="h-5 w-5 rounded border border-line"
                    />
                  ))}
                </div>
              </Field>
            )}

            <Field label="도트 굵기" hint={raster.pixel === 1 ? "원본 해상도" : `${raster.pixel}px 한 칸`}>
              <input
                type="range"
                min={1}
                max={12}
                value={raster.pixel}
                onChange={(e) => {
                  setRaster((r) => ({ ...r, pixel: +e.target.value }));
                  setConceptId("custom");
                }}
                className="w-32 accent-[var(--accent)]"
              />
            </Field>

            <Field label="디더링" hint={raster.dither === 0 ? "없음" : `${raster.dither}`}>
              <input
                type="range"
                min={0}
                max={100}
                value={raster.dither}
                onChange={(e) => {
                  setRaster((r) => ({ ...r, dither: +e.target.value }));
                  setConceptId("custom");
                }}
                className="w-32 accent-[var(--accent)]"
              />
            </Field>
          </>
        )}

        <button
          type="button"
          onClick={() => setTuning((v) => !v)}
          aria-expanded={tuning}
          className="ml-auto cursor-pointer rounded-lg border border-line bg-transparent px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          파라미터 직접 조정 {tuning ? "닫기" : "열기"}
        </button>
      </section>

      {/* 6 — 손조작. 접어 둔다. 대부분은 안 연다. */}
      {tuning && (
        <section className="mt-4 grid gap-x-8 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(KNOB_LABEL) as (keyof Knobs)[]).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink">{KNOB_LABEL[k][0]}</span>
              {/* 양끝을 슬라이더 좌우에 붙인다. 어느 쪽으로 미는지가 바로 보인다. */}
              <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                <span className="text-xs text-faint">{KNOB_LABEL[k][1]}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={knobs[k]}
                  onChange={(e) => {
                    setKnobs((prev) => ({ ...prev, [k]: +e.target.value }));
                    setConceptId("custom");
                  }}
                  className="accent-[var(--accent)]"
                />
                <span className="text-xs text-faint">{KNOB_LABEL[k][2]}</span>
              </span>
            </label>
          ))}
        </section>
      )}

          </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-semibold whitespace-nowrap text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs whitespace-nowrap text-faint">{hint}</span>}
    </div>
  );
}

function Frame({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      <div
        className={[
          "relative aspect-square overflow-hidden rounded-xl border bg-gradient-to-b from-surface-2 to-surface",
          accent ? "border-accent" : "border-line",
        ].join(" ")}
      >
        {children}
      </div>
      <figcaption className={`pt-2 text-xs ${accent ? "font-bold text-ink" : "text-faint"}`}>{label}</figcaption>
    </figure>
  );
}
