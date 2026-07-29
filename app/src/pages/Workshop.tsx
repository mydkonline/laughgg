import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PIECES, isModel, modelSrc } from "../data/pieces";
import {
  CONCEPTS,
  NEUTRAL,
  NEUTRAL_RASTER,
  KNOB_LABEL,
  knobsFromPrompt,
  matchedAxes,
  rasterFromPrompt,
  promptWantsSprite,
  scoreDelta,
  type Knobs,
  type RasterSet,
} from "../data/concepts";
import { REF_ID, extractPalette, palettes, setRefPalette, clearRefPalette } from "../data/palettes";
import { useCart } from "../lib/cart";
import { useUploads } from "../lib/uploads";
import { PromptBuilder, toPrompt } from "../components/PromptBuilder";
import { PromptComposer, type Reference } from "../components/PromptComposer";
import { ExportPicker } from "../components/ExportPicker";
import { TARGETS } from "../data/formats";
import { useCredit } from "../lib/credit";
import { useFeed } from "../lib/feed";
import { Preview } from "../three/Preview";
import { Sprite } from "../three/Sprite";
import { Thumb } from "../components/Thumb";
import { RankIcon, badgeOf, BADGE_LABEL } from "../components/Rank";
import { t } from "../lib/locale";

/* 스튜디오 — 가진 에셋을 이 게임의 느낌으로 가져오는 자리.

   들어오는 문은 셋(프롬프트·컨셉·손조작)인데 도착지는 하나다:
   Knobs 여섯 개 + RasterSet 셋. 이 아홉 숫자가 유일한 상태라서 결과가 재현되고
   통째로 남에게 넘어간다.

   화면은 프롬프트를 맨 위에 둔다. 대부분은 말로 쓰고 끝내고, 손조작은
   그다음에 다듬는 사람만 연다. */

/* 노브 이름을 화면 말로.

   블록 조립기가 쓰는 축 이름과 같은 말을 쓴다 — 같은 것을 두 군데서
   다르게 부르면 무엇이 걸렸는지 대조가 안 된다. */
const AXIS_LABEL: Record<string, string> = {
  tone: "분위기",
  warm: "색온도",
  gloss: "재질",
  facet: "면",
  sat: "색",
  line: "외곽선",
};

/* 참조 그림은 세 장까지. 도구마다 다르지만 어디든 상한이 있다. 여기서는
   마지막 한 장이 팔레트를 정하므로 많이 받을 이유가 없고, 받을수록 입력
   상자만 길어진다. */
const MAX_REFS = 3;

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
  /* 블록과 직접 입력은 서로 다른 입력칸이다.

     한 문자열을 같이 쓰게 뒀더니 블록을 하나 놓는 순간 타이핑한 문장이
     통째로 날아갔다. 둘은 같은 것을 다르게 적는 방법이 아니라 각자의
     자리다 — 블록은 옮겨 붙이는 것이고 직접 입력은 쓰는 것이다.

     각자 상태를 들고, 지금 켜진 쪽이 프롬프트가 된다. 오가며 눌러도
     반대쪽이 안 지워진다. */
  const [typed, setTyped] = useState("");
  /* 블록으로 조립해도 결과는 같은 문자열이라 해석기를 그대로 탄다. */
  const [blocks, setBlocks] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const prompt = typing ? typed : toPrompt(blocks);

  /* 프롬프트에서 실제로 읽어낸 축.

     `matchedAxes` 는 처음부터 "무엇을 읽었는지 보여줄 때 쓴다" 고 적어
     두고 안 쓰던 함수다. 입력칸을 키우면서 필요해졌다 — 길게 쓰게 해 놓고
     몇 개만 읽는다는 걸 안 알려 주면 쓴 사람이 오해한다. */
  const readAxes = useMemo(() => matchedAxes(prompt).map((k) => AXIS_LABEL[k] ?? k), [prompt]);
  const [knobs, setKnobs] = useState<Knobs>(() => CONCEPTS[0]!.knobs);
  const [raster, setRaster] = useState<RasterSet>(() => CONCEPTS[0]!.raster);

  /* 레퍼런스 이미지.

     올린 게임 화면에서 색을 뽑아 팔레트로 쓴다. 그림을 받아 두기만 하면
     장식이라, 실제로 결과를 바꾸는 자리에 꽂는다.

     objectURL 은 반드시 되돌려준다 — 안 하면 탭을 닫을 때까지 메모리에
     남는다. 페이지를 뜰 때도 한 번 훑는다. */
  const [refs, setRefs] = useState<Reference[]>([]);

  useEffect(
    () => () => {
      refs.forEach((r) => URL.revokeObjectURL(r.url));
    },
    // 뜰 때 한 번만 돈다. refs 를 넣으면 한 장 지울 때마다 나머지까지 풀린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addRefs = (files: FileList) => {
    for (const f of Array.from(files).slice(0, MAX_REFS)) {
      if (!f.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const colors = extractPalette(img);
        setRefs((prev) => {
          /* 총량을 막는다. 한 번에 세 장씩은 걸렀는데 여러 번 떨구면 계속
             쌓였다 — 썸네일이 줄을 넘길수록 컴포저가 그만큼 길어진다.
             오래된 것부터 뺀다. 마지막에 올린 것이 색을 정하므로 그게 맞다. */
          const kept = [...prev.filter((r) => r.url !== url), { url, name: f.name, colors }];
          for (const gone of kept.slice(0, -MAX_REFS)) URL.revokeObjectURL(gone.url);
          const next = kept.slice(-MAX_REFS);
          // 마지막에 올린 것이 팔레트를 정한다. 여러 장을 섞으면 어느 색인지 모른다.
          if (colors.length > 0) {
            setRefPalette(colors, f.name);
            setRaster((r) => ({ ...r, palette: REF_ID }));
            setAsSprite(true);
            setConceptId("custom");
          }
          return next;
        });
      };
      img.src = url;
    }
  };

  const dropRef = (url: string) => {
    URL.revokeObjectURL(url);
    setRefs((prev) => {
      const next = prev.filter((r) => r.url !== url);
      if (next.length === 0) {
        clearRefPalette();
        setRaster((r) => (r.palette === REF_ID ? { ...r, palette: "free" } : r));
      } else {
        const last = next[next.length - 1]!;
        setRefPalette(last.colors, last.name);
      }
      return next;
    });
  };
  const [asSprite, setAsSprite] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [target, setTarget] = useState(TARGETS[0]!.id);
  const [picks, setPicks] = useState<string[]>(TARGETS[0]!.picks);
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
    // 저장된 프리셋은 문장으로 남는다. 블록으로 되돌릴 수 없으니 직접 입력으로 연다.
    setTyped(src.prompt);
    setTyping(true);
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
    return <p className="mx-auto max-w-[760px] px-5 py-24 text-base text-muted">{t("불러올 에셋이 없습니다.")}</p>;
  }

  const spriteOnly = !isModel(piece);
  const sprite = asSprite || spriteOnly;
  const delta = scoreDelta(knobs);
  const after = Math.max(31, Math.min(99, piece.score + Math.round((delta.런타임 + delta.면구성 + delta.텍스처) / 2)));
  const conceptName = CONCEPTS.find((c) => c.id === conceptId)?.name ?? "직접 조정";
  const palette = palettes().find((p) => p.id === raster.palette);

  const onPublish = () => {
    const id = publish({
      pieceId: piece.id,
      title: t("{asset} 를 {concept} 톤으로", { asset: piece.t, concept: t(conceptName) }),
      /* 올릴 때 상황을 자동으로 채운다. 빈 칸을 내밀면 아무도 안 쓴다.
         나중에 본인이 고칠 수 있게 두는 게 맞지만, 시작은 채워 준다. */
      situation: t("{asset} 를 {concept} 프로젝트에 넣어야 했습니다.", { asset: piece.t, concept: t(conceptName) }),
      problem: sprite
        ? t("원본 그대로 넣으면 팔레트가 달라 기존 화면에서 튑니다.")
        : t("원본 그대로 넣으면 조명과 재질이 달라 배경과 따로 놉니다."),
      steps: [
        prompt.trim()
          ? t("프롬프트로 방향을 잡는다: {p}", { p: prompt.trim() })
          : t("컨셉을 {concept} 으로 고른다", { concept: t(conceptName) }),
        sprite
          ? t("팔레트를 {palette} 로 고정하고 도트 굵기를 {px} 로 둔다", { palette: t(palette?.name ?? "자유"), px: raster.pixel })
          : t("조명과 재질을 컨셉값으로 맞춘다"),
        t("검수 {before} 에서 {after} 로 바뀐 것을 확인한다", { before: piece.score, after }),
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
    <main className="mx-auto max-w-[1240px] px-5 pt-8 pb-20">

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
          <span className="text-xs font-bold text-ink">{t("내 라이브러리")}</span>
          <span className="text-xs text-faint">
            {mine.length
              ? t("올린 파일 {n}개", { n: mine.length })
              : cartIds.length
                ? t("산 에셋 {n}개", { n: cartIds.length })
                : t("아직 비어 있어 마켓 상위를 올려 뒀습니다")}
          </span>
          <label className="ml-auto cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-ink">
            {t("파일 올리기")}
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
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 cursor-pointer rounded-lg border border-line bg-ground text-[10px] text-faint hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

      </section>
      {/* 2 — 결과. 조작을 그림 위에 두면 보면서 못 만진다. 그림이 먼저고,
          원본과 나란히 두지 않으면 무엇이 달라졌는지 안 보인다. */}
      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {/* 좁은 화면에서도 2단으로 둔다. 세로로 쌓으면 프롬프트가 화면 두 개 아래로 밀린다. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Frame label={t("원본")}>
            {sprite ? (
              <Sprite piece={piece} knobs={NEUTRAL} raster={NEUTRAL_RASTER} />
            ) : (
              <Preview model={modelSrc(piece)!} knobs={NEUTRAL} className="h-full w-full" />
            )}
          </Frame>
          <Frame
              label={`${t(conceptName)}${sprite ? ` (${t(palette?.name ?? "스프라이트")})` : ""}`}
              accent
            >
            {sprite ? (
              <Sprite piece={piece} knobs={knobs} raster={raster} />
            ) : (
              <Preview model={modelSrc(piece)!} knobs={knobs} className="h-full w-full" />
            )}
          </Frame>
          </div>

          {/* 컨셉을 하나씩 눌러 보면 열한 번 눌러야 안다. 한 번에 다 보여 주고
              마음에 드는 걸 고르게 한다. 전부 정지 그림이라 굽는 렌더러 하나를
              돌려 쓴다 — 라이브 렌더러를 열한 개 만들 수는 없다. */}
          <div className="mt-5">
            <p className="mb-2.5 text-xs text-faint">{t("컨셉별로 미리 보기")}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {CONCEPTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyConcept(c.id)}
                  aria-pressed={conceptId === c.id}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <span
                    className={[
                      "relative block aspect-square overflow-hidden rounded-lg border bg-gradient-to-b from-surface-2 to-surface",
                      conceptId === c.id ? "border-accent" : "border-line hover:border-chrome-600",
                    ].join(" ")}
                  >
                    <Sprite piece={piece} knobs={c.knobs} raster={c.raster} />
                  </span>
                  <span
                    className={[
                      "mt-1.5 block truncate text-[10px]",
                      conceptId === c.id ? "font-bold text-ink" : "text-faint",
                    ].join(" ")}
                  >
                    {t(c.name)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 조작 패널. 그림 옆에 둔다 — 프롬프트가 이 제품이 파는 것이라
            스크롤을 내려야 보이면 안 된다.

            한때 이 패널이 뷰포트보다 커서 안에 스크롤을 뒀는데, 블록 팔레트를
            탭으로 접은 뒤로는 패널이 화면 안에 들어온다. 그래서 내부 스크롤을
            뺐다 — 패널 안에서 또 굴리는 건 스크롤이 두 겹이라 헷갈린다.
            sticky 로 붙여 두기만 하면 왼쪽 그림 옆에 그대로 머문다. */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-[100px] lg:self-start">
          {/* 컨셉이 먼저다. 늘어나는 목록이라 칩을 늘어놓지 않고 드롭다운으로 —
              시각 브라우즈는 왼쪽 "컨셉별로 미리 보기" 그리드가 맡는다. */}
          <Group
            title={t("게임 컨셉")}
            hint={t(CONCEPTS.find((c) => c.id === conceptId)?.note ?? "파라미터를 직접 조정한 상태입니다.")}
          >
            <select
              value={CONCEPTS.some((c) => c.id === conceptId) ? conceptId : "custom"}
              onChange={(e) => e.target.value !== "custom" && applyConcept(e.target.value)}
              className={SELECT}
            >
              {CONCEPTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
              {!CONCEPTS.some((c) => c.id === conceptId) && (
                <option value="custom">{t("직접 조정")}</option>
              )}
            </select>
          </Group>

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-xs font-bold text-ink">{t("프롬프트")}</h2>
              <span className="flex overflow-hidden rounded-lg border border-line">
                {[
                  [false, t("블록")],
                  [true, t("직접 입력")],
                ].map(([v, label]) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setTyping(v as boolean)}
                    aria-pressed={typing === v}
                    className={[
                      "cursor-pointer border-0 px-3 py-1 text-xs",
                      typing === v
                        ? "bg-ink font-bold text-ground"
                        : "bg-transparent text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {label as string}
                  </button>
                ))}
              </span>
            </div>

            {/* 입력·첨부·전송이 한 상자다. 흩어 놓으니 무엇을 눌러야
                시작되는지가 안 보였고, 전송 버튼이 없는 것처럼 읽혔다. */}
            <PromptComposer
              value={typed}
              onChange={setTyped}
              onSubmit={applyPrompt}
              disabled={remaining < 1 || !prompt.trim()}
              credits={remaining}
              free={free}
              refs={refs}
              onAddRef={addRefs}
              onDropRef={dropRef}
              typing={typing}
              readAxes={readAxes}
            >
              {!typing && <PromptBuilder picked={blocks} onChange={setBlocks} />}
            </PromptComposer>

            {remaining < 1 && (
              <p className="mt-2 text-xs text-[#FF6B7A]">
                {t("무료 크레딧을 다 썼습니다. 컨셉 프리셋과 직접 조정은 계속 무료입니다.")}
              </p>
            )}
          </div>
          <Group title={t("출력 형식")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {([false, true] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={spriteOnly && !v}
                    onClick={() => setAsSprite(v)}
                    aria-pressed={sprite === v}
                    className={[
                      "cursor-pointer rounded-lg border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40",
                      sprite === v
                        ? "border-transparent bg-ink font-bold text-ground"
                        : "border-line text-muted hover:border-accent hover:text-ink",
                    ].join(" ")}
                  >
                    {t(v ? "2D 스프라이트" : "3D 모델")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTuning((v) => !v)}
                aria-expanded={tuning}
                className="cursor-pointer rounded-lg border border-line bg-transparent px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                {t(tuning ? "파라미터 직접 조정 닫기" : "파라미터 직접 조정 열기")}
              </button>
            </div>

        {sprite && (
            <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
            <Field label={t("팔레트")} hint={palette?.from ? t(palette.from) : undefined}>
              <select
                value={raster.palette}
                onChange={(e) => {
                  setRaster((r) => ({ ...r, palette: e.target.value }));
                  setConceptId("custom");
                }}
                className="rounded-lg border border-line bg-ground px-3 py-1.5 text-xs text-ink"
              >
                {palettes().map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.name)}
                  </option>
                ))}
              </select>
            </Field>

            {palette && palette.colors.length > 0 && (
              <Field label={t("쓰는 색")}>
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

            <Field label={t("도트 굵기")} hint={raster.pixel === 1 ? t("원본 해상도") : t("{n}px 한 칸", { n: raster.pixel })}>
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

            <Field label={t("디더링")} hint={raster.dither === 0 ? t("없음") : `${raster.dither}`}>
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
            </div>
        )}
          </Group>
          <ExportPicker
            tex={piece.tex}
            target={target}
            onTarget={setTarget}
            picks={picks}
            onPicks={setPicks}
          />

          <div className="flex flex-col rounded-xl border border-line bg-surface p-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xs text-faint">{t("분석")}</span>
            <b className="text-base tabular-nums text-faint line-through">{piece.score}</b>
            <b className="num text-4xl text-ink">{after}</b>
          </div>
          <span className="mt-2 flex w-fit items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-extrabold text-accent">
            <RankIcon badge={badgeOf(after)} size={14} />
            {t(BADGE_LABEL[badgeOf(after)])}
          </span>

          <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
            {Object.entries(delta).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <dt className="text-muted">{t(k)}</dt>
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
                className="flex-1 cursor-pointer rounded-lg border-0 bg-accent px-3 py-2 text-xs font-bold text-ground"
              >
                {t("피드에서 보기")}
              </button>
              <button
                type="button"
                onClick={() => setPublished(null)}
                className="cursor-pointer rounded-lg border border-line bg-transparent px-3 py-2 text-xs text-muted"
              >
                {t("더 만지기")}
              </button>
            </div>
          ) : (
            <div className="mt-auto pt-3">
              <button
                type="button"
                onClick={onPublish}
                className="w-full cursor-pointer rounded-lg border-0 bg-accent px-4 py-2.5 text-xs font-bold text-ground hover:bg-accent-strong"
              >
                {t("프리셋 저장")}
              </button>
            </div>
          )}
          </div>
        </aside>
      </section>




      {/* 4 — 손조작. 접어 둔다. 대부분은 안 연다. */}
      {tuning && (
        <section className="mt-4 grid gap-x-8 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(KNOB_LABEL) as (keyof Knobs)[]).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink">{t(KNOB_LABEL[k][0])}</span>
              {/* 양끝을 슬라이더 좌우에 붙인다. 어느 쪽으로 미는지가 바로 보인다. */}
              <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                <span className="text-xs text-faint">{t(KNOB_LABEL[k][1])}</span>
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
                <span className="text-xs text-faint">{t(KNOB_LABEL[k][2])}</span>
              </span>
            </label>
          ))}
        </section>
      )}

          </main>
  );
}

/* 오른쪽 조작 패널의 옵션 그룹. 라벨(굵게)+힌트(연하게)를 머리에 두고 컨트롤을
   아래에 둔다 — 모든 그룹이 같은 머리 구조라 패널이 균일하게 읽힌다. 늘어나는
   단일 선택(컨셉·엔진)은 칩을 늘어놓지 않고 이 SELECT 로 드롭다운을 쓴다. */
const SELECT =
  "w-full cursor-pointer rounded-lg border border-line bg-ground px-3 py-2 text-xs text-ink";

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-xs font-bold text-ink">{title}</h2>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
      {children}
    </section>
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
