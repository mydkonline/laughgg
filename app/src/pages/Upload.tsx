import { useCallback, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { ApiError, api, type AnalysisResult } from "../lib/api";
import { humanBytes, sha256 } from "../lib/hash";
import { useAccount } from "../lib/account";
import { BADGE_LABEL, badgeKeyOf } from "../components/Rank";
import { CHECKS } from "../data/checks";
import { REUSE_AXIS } from "../data/reuse";
import { ReuseBadge } from "../components/ReuseBadge";
import { t } from "../lib/locale";

/** 서버 배지를 화면 말로. 옮기는 표는 Rank 에 하나만 둔다. */
function badgeLabel(badge: string) {
  const key = badgeKeyOf(badge);
  return key ? t(BADGE_LABEL[key]) : badge;
}

/* 에셋 올리기.

   다른 마켓들을 보고 순서를 정했다.
     Sketchfab   드래그가 진입점이다. 파일을 놓기 전에는 아무것도 안 묻는다
     Unity       제출 → 심사. 출처 신고(AI 생성 포함)를 요구한다
     itch.io     가격을 마지막에 묻는다. 물건이 정해지기 전에 값을 못 매긴다

   **점수는 올리는 사람이 정하지 않는다.** 처음엔 슬라이더로 만들었는데,
   그러면 다들 100 을 놓고 챌린저를 받는다. 배지가 아무 의미가 없어지고
   "검증된 마켓" 이라는 말이 그 자리에서 무너진다.

   서버가 파일을 뜯어 매긴다. 여기서 묻는 건 파일로 알 수 없는 것 하나 —
   출처다. 그건 점수가 아니라 나중에 감사할 수 있는 기록이다. */

const CATEGORIES = [
  ["env", "환경/구조물"],
  ["weapon", "무기/방어구"],
  ["char", "캐릭터/도트"],
  ["prop", "소품"],
  ["light", "조명"],
  ["furniture", "가구"],
  ["tool", "툴/키트"],
  ["util", "범용 유틸"],
] as const;

const ENGINES = ["unity", "unreal", "godot", "any"] as const;
const STYLES = [
  ["realistic", "사실적"],
  ["stylized", "스타일라이즈"],
  ["pixel", "도트"],
  ["lowpoly", "로우폴리"],
] as const;

/* 출처.

   파일로는 알 수 없어서 묻는다. Unity 도 2026 기준 AI 생성 여부 신고를
   요구한다 — 같은 이유다.

   확인된 게 아니라 신고라서 어느 것도 만점을 받지 않는다. */
const ORIGINS = [
  ["self_made", "직접 만들었습니다", "확인할 방법이 없어 중간 점수입니다"],
  ["public_domain", "CC0 등 공개 출처", "출처를 검증할 수 있어 높습니다"],
  ["licensed", "상업 라이선스 구매", "영수증으로 확인할 수 있습니다"],
  ["ai_generated", "AI로 만들었습니다", "학습 소스를 역추적할 수 없습니다"],
] as const;

/** 지금 서버가 뜯을 수 있는 형식. 못 읽는 걸 받으면 채점이 안 된다. */
const ACCEPT = ".glb";

type Stage =
  | { at: "idle" }
  | { at: "hashing"; name: string; ratio: number }
  | { at: "ready"; file: File; sha: string }
  | { at: "publishing"; step: string }
  | { at: "done"; assetId: number; result: AnalysisResult | null };

export function Upload() {
  const auth = useAccount();
  const [stage, setStage] = useState<Stage>({ at: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("prop");
  const [engine, setEngine] = useState<string>("unity");
  const [style, setStyle] = useState<string>("realistic");
  const [price, setPrice] = useState("20");
  const [origin, setOrigin] = useState<string>("self_made");
  /* 캐릭터 전용. 포함 애니메이션을 쉼표로 받는다 — 이 유형은 모션이
     make-or-break라 안 받으면 장롱을 파는 셈이 된다. */
  const [anims, setAnims] = useState("");
  const animList = anims.split(",").map((s) => s.trim()).filter(Boolean);
  /* 툴/키트 전용. 튜토리얼 영상과 문서 링크를 받는다 — 이 유형은 지원이
     make-or-break라, 둘 다 없으면 스샷만 있는 툴이 되어 초보에겐 장롱이다. */
  const [tut, setTut] = useState("");
  const [docs, setDocs] = useState("");

  const take = useCallback(async (file: File) => {
    setError(null);
    setStage({ at: "hashing", name: file.name, ratio: 0 });
    try {
      const sha = await sha256(file, (ratio) =>
        setStage({ at: "hashing", name: file.name, ratio }),
      );
      setStage({ at: "ready", file, sha });
      setTitle((was) => was || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim());
    } catch {
      setError(t("파일을 읽지 못했습니다."));
      setStage({ at: "idle" });
    }
  }, []);

  if (auth.status === "loading") {
    return <main className="mx-auto max-w-[720px] px-5 py-16 text-xs text-faint">{t("불러오는 중")}</main>;
  }
  if (auth.status === "anon") return <Navigate to="/join?mode=login" replace />;

  async function publish() {
    if (stage.at !== "ready") return;
    const { file, sha } = stage;
    setError(null);

    try {
      /* 파일을 먼저 올린다. 등록이 먼저면 파일 없는 상품이 남는다.
         스토리지가 안 붙어 있으면 503 이 온다 — 그때는 키만 정해 두고 넘어간다. */
      setStage({ at: "publishing", step: t("파일을 올리는 중") });
      let fileRef = {
        file_key: `uploads/local/${sha}.glb`,
        file_bytes: file.size,
        file_sha256: sha,
      };
      try {
        const target = await api.uploadIntent(file.name, file.size, sha);
        const put = await fetch(target.upload_url, { method: "PUT", body: file });
        if (!put.ok) throw new Error("storage rejected the file");
        fileRef = { ...fileRef, file_key: target.file_key };
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 503) throw e;
      }

      setStage({ at: "publishing", step: t("등록하는 중") });
      const created = await api.createAsset({
        title: title.trim(),
        category,
        engine,
        art_style: style,
        price_usd: Number(price) || 0,
        origin,
        ...(category === "char" && animList.length ? { animations: animList } : {}),
        ...(category === "tool" && tut.trim() ? { tutorial_url: tut.trim() } : {}),
        ...(category === "tool" && docs.trim() ? { docs_url: docs.trim() } : {}),
        ...fileRef,
      });

      /* 여기서 배지가 나온다. 서버가 파일을 뜯어 채점한다.
         우리가 보낸 건 파일과 출처뿐이고 점수는 안 보냈다. */
      setStage({ at: "publishing", step: t("분석하는 중") });
      let result: AnalysisResult | null = null;
      try {
        result = await api.analyzeAsset(created.asset_id, file);
      } catch (e) {
        // 분석이 실패해도 등록은 살아 있다. 초안으로 남는다.
        setError(
          e instanceof ApiError
            ? `${t("등록은 됐지만 분석에 실패했습니다.")} ${e.message}`
            : t("등록은 됐지만 분석에 실패했습니다."),
        );
      }
      setStage({ at: "done", assetId: created.asset_id, result });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("등록하지 못했습니다."));
      setStage({ at: "ready", file, sha });
    }
  }

  if (stage.at === "done") {
    return <Done assetId={stage.assetId} title={title} result={stage.result} error={error} />;
  }

  const busy = stage.at === "publishing";

  return (
    <main className="mx-auto max-w-[720px] px-5 py-12">
      <p className="text-xs tracking-wide text-accent">{t("창작자")}</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">{t("에셋 올리기")}</h1>
      <p className="mt-2 text-xs text-muted">
        {t("올리면 서버가 파일을 뜯어 채점합니다. 심사를 기다리지 않습니다.")}
      </p>

      {/* 1. 파일 — 드래그가 진입점이다. 놓기 전에는 아무것도 안 묻는다. */}
      <Step n="01" title={t("파일")}>
        {stage.at === "hashing" ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="truncate text-xs text-ink">{stage.name}</p>
            <div className="mx-auto mt-4 h-1 max-w-[280px] overflow-hidden rounded-lg bg-surface-2">
              <span
                className="block h-full bg-accent transition-[width]"
                style={{ width: `${Math.round(stage.ratio * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] text-faint">
              {t("파일을 확인하는 중 {n}%", { n: Math.round(stage.ratio * 100) })}
            </p>
          </div>
        ) : stage.at === "ready" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface p-5">
            <b className="min-w-0 flex-1 truncate text-xs text-ink">{stage.file.name}</b>
            <span className="num shrink-0 text-xs text-faint">{humanBytes(stage.file.size)}</span>
            <button
              type="button"
              onClick={() => setStage({ at: "idle" })}
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs text-faint hover:text-ink"
            >
              {t("바꾸기")}
            </button>
            {/* 해시를 보여 준다. 받는 쪽이 같은 값을 확인할 수 있어야 한다. */}
            <p className="num w-full truncate text-[10px] text-faint">SHA-256 {stage.sha}</p>
          </div>
        ) : busy ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-xs text-muted motion-safe:animate-pulse">{stage.step}</p>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void take(f);
            }}
            className={[
              "rounded-2xl border border-dashed p-10 text-center transition-colors",
              dragging ? "border-accent bg-accent-soft" : "border-line bg-surface",
            ].join(" ")}
          >
            <p className="text-xs text-ink">{t("여기에 파일을 놓으세요")}</p>
            {/* 지금 뜯을 수 있는 형식만 받는다. */}
            <p className="mt-1 text-[10px] text-faint">{t("glb 최대 2GB")}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-5 cursor-pointer rounded-xl border border-line bg-transparent px-5 py-2.5 text-xs font-semibold text-muted hover:border-accent hover:text-ink"
            >
              {t("파일 고르기")}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void take(f);
              }}
            />
          </div>
        )}
      </Step>

      {/* 2. 정보 */}
      <Step n="02" title={t("정보")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-faint">{t("제목")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
              placeholder="Gothic Statue"
            />
          </label>
          <Chips
            label={t("분류")}
            value={category}
            onPick={setCategory}
            options={CATEGORIES.map(([k, name]) => [k, t(name)] as const)}
          />
          {/* 장롱 방지 축. 분류를 고르는 순간, 이 유형에서 구매자가 무엇을 먼저
              보는지 알려 준다 — 캐릭터면 그림이 아니라 애니메이션이다. 여기서
              무엇을 채워야 팔리는지 알아야 올린 뒤 장롱이 안 된다. */}
          {REUSE_AXIS[category] && (
            <div className="-mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-surface px-3.5 py-2.5">
              <span className="text-[10px] font-bold text-accent">{t("핵심 체크")}</span>
              <span className="text-xs font-bold text-ink">{t(REUSE_AXIS[category]!.axis)}</span>
              <span className="text-[11px] text-faint">{t(REUSE_AXIS[category]!.note)}</span>
              <ReuseBadge cat={category} className="ml-auto shrink-0" />
            </div>
          )}
          {/* 캐릭터면 포함 애니메이션을 실제로 받는다. 위 축이 "말"이라면 여기가
              그 축을 채우는 자리다 — 이게 비면 구매자가 걸러야 할 정적 캐릭터다. */}
          {category === "char" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-faint">{t("포함 애니메이션")}</span>
              <input
                value={anims}
                onChange={(e) => setAnims(e.target.value)}
                className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
                placeholder={t("걷기, 달리기, 공격, 피격, 사망")}
              />
              {animList.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {animList.map((a) => (
                    <span key={a} className="rounded-lg bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                      {a}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-[10px] text-[#FF6B7A]">
                  {t("비워 두면 정적 캐릭터로 표시됩니다 — 원하는 모션이 없는 캐릭터는 대부분 장롱이 됩니다.")}
                </span>
              )}
            </label>
          )}
          {/* 툴/키트면 지원(튜토리얼·문서)을 받는다. 이 유형은 지원이
              make-or-break라, 둘 다 없으면 초보에겐 장롱이 되는 스샷 툴이다. */}
          {category === "tool" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-faint">{t("튜토리얼 영상 URL")}</span>
                <input
                  value={tut}
                  onChange={(e) => setTut(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
                  placeholder="https://youtu.be/..."
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-faint">{t("문서 URL")}</span>
                <input
                  value={docs}
                  onChange={(e) => setDocs(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
                  placeholder="https://docs..."
                />
              </label>
              {!tut.trim() && !docs.trim() && (
                <span className="text-[10px] text-[#FF6B7A]">
                  {t("튜토리얼도 문서도 없으면 초보 경고가 붙습니다 — 스샷만 있는 툴은 대부분 장롱이 됩니다.")}
                </span>
              )}
            </div>
          )}
          <Chips
            label={t("엔진")}
            value={engine}
            onPick={setEngine}
            /* 엔진 이름은 옮기지 않는다. UNITY 는 어느 말로 써도 UNITY 다 —
               번역표에 넣으면 "안 옮긴 것" 목록에 영영 남는다. */
            options={ENGINES.map(
              (e) => [e, e === "any" ? t("가리지 않음") : e.toUpperCase()] as const,
            )}
          />
          <Chips
            label={t("화풍")}
            value={style}
            onPick={setStyle}
            options={STYLES.map(([k, name]) => [k, t(name)] as const)}
          />
        </div>
      </Step>

      {/* 3. 출처 — 파일로 알 수 없는 유일한 것이다. */}
      <Step n="03" title={t("출처")} note={t("파일로는 알 수 없어 여쭤봅니다")}>
        <div className="flex flex-col gap-2">
          {ORIGINS.map(([id, label, why]) => (
            <button
              key={id}
              type="button"
              onClick={() => setOrigin(id)}
              aria-pressed={origin === id}
              className={[
                "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors",
                origin === id
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-chrome-600",
              ].join(" ")}
            >
              <b className={`text-xs ${origin === id ? "text-ink" : "text-muted"}`}>{t(label)}</b>
              <span className="mt-0.5 text-[10px] text-faint">{t(why)}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-faint">
          {t(
            "신고는 기록으로 남고 나중에 확인합니다. 밝히지 않으면 노출에서 제외됩니다 — 출처를 모르는 물건을 파는 것이 이 마켓이 없애려는 것입니다.",
          )}
        </p>
      </Step>

      {/* 4. 가격 */}
      <Step n="04" title={t("가격")}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="text-xs text-faint">USD</span>
            <input
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="num w-20 border-0 bg-transparent text-base text-ink outline-none"
            />
          </span>
          <p className="text-xs text-faint">
            {t("수수료 8%, 하나 팔릴 때 {take} 받습니다", {
              take: `$${((Number(price) || 0) * 0.92).toFixed(2)}`,
            })}
          </p>
        </div>
      </Step>

      {/* 무엇으로 재는지 미리 보여 준다. 알아야 고칠 수 있다. */}
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <p className="text-xs font-bold text-ink">{t("무엇을 봅니까")}</p>
        <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <div key={c.key} className="flex items-baseline gap-2.5 border-b border-line-soft pb-2">
              <dt className="min-w-0 flex-1 truncate text-xs text-muted">{t(c.label)}</dt>
              <dd className="m-0 shrink-0 text-[10px] text-faint">{t(c.why)}</dd>
              <dd className="num m-0 w-8 shrink-0 text-right text-xs text-ink">{c.weight}%</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[10px] leading-relaxed text-faint">
          {t(
            "라이선스 출처를 뺀 항목은 파일에서 잽니다. 코드 품질은 메시 에셋에 해당이 없어 그 가중치를 나머지에 나눕니다 — 없는 항목으로 깎지 않습니다.",
          )}
        </p>
      </section>

      {error && (
        <p role="alert" className="mt-8 rounded-xl border border-accent px-4 py-3 text-xs text-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void publish()}
        disabled={stage.at !== "ready" || !title.trim()}
        className="mt-8 w-full cursor-pointer rounded-xl border-0 bg-accent px-6 py-4 text-xs font-bold text-ground hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? stage.step : t("등록하고 채점받기")}
      </button>
      {stage.at === "idle" && (
        <p className="mt-3 text-center text-[10px] text-faint">{t("파일을 먼저 올려 주세요")}</p>
      )}
    </main>
  );
}

/** 채점이 끝난 화면. 여기서 처음 배지를 본다. */
function Done({
  assetId,
  title,
  result,
  error,
}: {
  assetId: number;
  title: string;
  result: AnalysisResult | null;
  error: string | null;
}) {
  return (
    <main className="mx-auto max-w-[600px] px-5 py-16">
      <p className="text-xs tracking-wide text-accent">{t("등록 완료")}</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">{title}</h1>

      {result ? (
        <>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-6">
            <div>
              <dt className="text-xs text-faint">{t("배지")}</dt>
              <dd className="num m-0 mt-1 text-2xl text-accent">
                {badgeLabel(result.badge)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-faint">{t("총점")}</dt>
              <dd className="num m-0 mt-1 text-2xl text-ink">{result.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">{t("판매")}</dt>
              <dd className="m-0 mt-1 text-2xl text-ink">
                {t(result.production_ready ? "가능" : "제외")}
              </dd>
            </div>
          </dl>

          <dl className="mt-6">
            {CHECKS.map((c) => {
              const v = result.scores[c.key];
              return (
                <div
                  key={c.key}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                >
                  <dt className="w-24 shrink-0 text-xs text-faint">{t(c.label)}</dt>
                  {/* 해당 없음이면 막대를 아예 안 그린다. 빈 트랙을 두면
                      길이 0 짜리 막대로 읽혀서 0점처럼 보인다. */}
                  <dd
                    className={[
                      "m-0 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full",
                      v === null || v === undefined ? "" : "bg-surface-2",
                    ].join(" ")}
                  >
                    {v !== null && v !== undefined && (
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${v}%` }}
                      />
                    )}
                  </dd>
                  <dd className="num m-0 w-16 shrink-0 text-right text-xs text-ink">
                    {/* 해당 없음을 0 으로 보여 주면 깎인 것처럼 읽힌다. */}
                    {v === null || v === undefined ? (
                      <span className="text-[10px] font-normal text-faint">{t("해당 없음")}</span>
                    ) : (
                      v
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>

          {result.notes.length > 0 && (
            <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-bold text-ink">{t("고칠 것")}</p>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {result.notes.map((n) => (
                  <li key={n} className="text-xs leading-relaxed text-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="mt-8 rounded-xl border border-line px-4 py-3 text-xs text-muted">
          {error ?? t("분석 결과를 받지 못했습니다. 초안으로 저장됐습니다.")}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={`/market/${assetId}`}
          className="rounded-xl bg-accent px-5 py-3 text-xs font-bold text-ground no-underline hover:bg-accent-strong"
        >
          {t("상품 보기")}
        </Link>
        <Link
          to="/library"
          className="rounded-xl border border-line px-5 py-3 text-xs font-semibold text-muted no-underline hover:border-accent hover:text-ink"
        >
          {t("내 라이브러리")}
        </Link>
      </div>
    </main>
  );
}

/** 번호를 붙인 단계. 순서가 있는 것이라 번호가 정보가 된다. */
function Step({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num text-xs text-faint">{n}</span>
        <b className="text-base font-bold text-ink">{title}</b>
        {note && <span className="text-xs text-faint">{note}</span>}
      </p>
      {children}
    </section>
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
  /** 이미 화면 말로 옮겨서 넘어온다. 여기서 또 t() 를 태우면 두 번 찾는다. */
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
            "cursor-pointer rounded-lg border px-3.5 py-1.5 text-xs",
            value === key
              ? "border-transparent bg-ink font-bold text-ground"
              : "border-line text-muted hover:border-accent hover:text-ink",
          ].join(" ")}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
