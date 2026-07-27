import { useCallback, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { ApiError, api, type Scores } from "../lib/api";
import { humanBytes, sha256 } from "../lib/hash";
import { useAccount } from "../lib/account";
import { CHECKS } from "../data/checks";

/* 에셋 올리기.

   다른 마켓들을 보고 순서를 정했다.
     Sketchfab   드래그가 진입점이다. 파일을 놓기 전에는 아무것도 안 묻는다
     Unity       제출 → 심사 → 공개. 심사 전에 초안으로 남는다
     itch.io     가격을 마지막에 묻는다. 물건이 정해지기 전에 값을 못 매긴다

   우리는 심사가 사람이 아니라 7항목 자동 분석이라, Unity 가 며칠 걸리는
   자리를 그 자리에서 보여 준다. 그게 이 제품이 파는 것이므로 화면에서도
   제일 크게 온다.

   단계를 나눠 놓되 한 화면에 둔다. 페이지를 넘기면 앞 단계를 고치러 돌아갈 때
   지금까지 친 걸 잃는다. */

const CATEGORIES = [
  ["env", "환경/구조물"],
  ["weapon", "무기/방어구"],
  ["char", "캐릭터/도트"],
  ["prop", "소품"],
  ["light", "조명"],
  ["furniture", "가구"],
] as const;

const ENGINES = ["unity", "unreal", "godot", "any"] as const;
const STYLES = [
  ["realistic", "사실적"],
  ["stylized", "스타일라이즈"],
  ["pixel", "도트"],
  ["lowpoly", "로우폴리"],
] as const;

/** 받는 파일. 엔진이 실제로 읽는 것만 연다. */
const ACCEPT = ".glb,.gltf,.fbx,.obj,.png,.zip";

type Stage =
  | { at: "idle" }
  | { at: "hashing"; name: string; ratio: number }
  | { at: "ready"; file: File; sha: string }
  | { at: "publishing" }
  | { at: "done"; assetId: number; badge: string; total: number };

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

  /* 점수는 사람이 적는 게 아니다. 실제 서비스에서는 파일을 뜯어 7항목을
     채점하고, 그건 서버가 할 일이다. 지금은 그 분석기가 없어서 화면에서
     값을 정해 보내고, 아래에 그렇다고 적어 둔다. */
  const [scores, setScores] = useState<Scores>({
    mesh_integrity: 88,
    texture_quality: 86,
    lod_setup: 82,
    runtime_cost: 90,
    license_clean: 95,
    code_quality: 80,
    integration: 85,
  });

  const take = useCallback(async (file: File) => {
    setError(null);
    setStage({ at: "hashing", name: file.name, ratio: 0 });
    try {
      const sha = await sha256(file, (ratio) =>
        setStage({ at: "hashing", name: file.name, ratio }),
      );
      setStage({ at: "ready", file, sha });
      // 제목을 안 적었으면 파일 이름을 넣어 둔다. 지우고 쓰면 된다.
      // 확장자를 떼고 구분자를 공백으로 바꾼다 — gothic-statue 보다 읽기 낫다.
      setTitle((t) =>
        t || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
      );
    } catch {
      setError("파일을 읽지 못했습니다.");
      setStage({ at: "idle" });
    }
  }, []);

  if (auth.status === "loading") {
    return <main className="mx-auto max-w-[720px] px-5 py-16 text-xs text-faint">불러오는 중</main>;
  }
  // 올린 사람이 창작자다. 로그인 없이는 올릴 수 없다.
  if (auth.status === "anon") return <Navigate to="/join?mode=login" replace />;

  /* 총점은 서버가 다시 센다. 여기서 보여 주는 건 미리보기다 —
     가중치가 갈리면 화면과 결과가 달라지므로 같은 값을 쓴다. */
  const total = Math.round(
    CHECKS.reduce((sum, c) => sum + scores[c.key] * c.weight, 0) / 100,
  );
  const badge =
    scores.license_clean < 60 ? "실버"
    : total >= 90 ? "챌린저"
    : total >= 80 ? "다이아"
    : total >= 70 ? "플래티넘"
    : "실버";

  async function publish() {
    if (stage.at !== "ready") return;
    setError(null);
    setStage({ at: "publishing" });
    try {
      /* 파일을 먼저 올린다. 등록이 먼저면 파일 없는 상품이 남는다.
         스토리지가 안 붙어 있으면 여기서 503 이 온다 — 그 경우 파일 없이
         초안으로 등록한다. 못 파는 상태지만 정보는 남는다. */
      let file: { file_key: string; file_bytes: number; file_sha256: string } | undefined;
      try {
        const target = await api.uploadIntent(stage.file.name, stage.file.size, stage.sha);
        const put = await fetch(target.upload_url, { method: "PUT", body: stage.file });
        if (!put.ok) throw new Error("storage rejected the file");
        file = {
          file_key: target.file_key,
          file_bytes: stage.file.size,
          file_sha256: stage.sha,
        };
      } catch (e) {
        if (e instanceof ApiError && e.status === 503) {
          file = undefined; // 스토리지가 꺼져 있다. 초안으로 간다.
        } else {
          throw e;
        }
      }

      const result = await api.createAsset({
        title: title.trim(),
        category,
        engine,
        art_style: style,
        price_usd: Number(price) || 0,
        scores,
        ...file,
      });
      setStage({ at: "done", assetId: result.asset_id, badge: result.badge, total: result.total });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "등록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setStage({ at: "ready", file: (stage as { file: File }).file, sha: (stage as { sha: string }).sha });
    }
  }

  if (stage.at === "done") {
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16">
        <p className="text-xs tracking-wide text-accent">등록 완료</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{title}</h1>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-6">
          <div>
            <dt className="text-xs text-faint">배지</dt>
            <dd className="num m-0 mt-1 text-2xl text-accent">{BADGE_KO[stage.badge] ?? stage.badge}</dd>
          </div>
          <div>
            <dt className="text-xs text-faint">총점</dt>
            <dd className="num m-0 mt-1 text-2xl text-ink">{stage.total}</dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/market/${stage.assetId}`}
            className="rounded-xl bg-accent px-5 py-3 text-xs font-bold text-white no-underline hover:bg-accent-strong"
          >
            상품 보기
          </Link>
          <button
            type="button"
            onClick={() => {
              setStage({ at: "idle" });
              setTitle("");
            }}
            className="cursor-pointer rounded-xl border border-line bg-transparent px-5 py-3 text-xs font-semibold text-muted hover:border-accent hover:text-ink"
          >
            하나 더 올리기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[720px] px-5 py-12">
      <p className="text-xs tracking-wide text-accent">창작자</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">에셋 올리기</h1>
      <p className="mt-2 text-xs text-muted">
        올리면 7항목을 채점해 배지를 매깁니다. 심사를 기다리지 않습니다.
      </p>

      {/* 1. 파일 — 드래그가 진입점이다. 놓기 전에는 아무것도 안 묻는다. */}
      <Step n="01" title="파일">
        {stage.at === "hashing" ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="truncate text-xs text-ink">{stage.name}</p>
            <div className="mx-auto mt-4 h-1 max-w-[280px] overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full bg-accent transition-[width]"
                style={{ width: `${Math.round(stage.ratio * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] text-faint">
              파일을 확인하는 중 {Math.round(stage.ratio * 100)}%
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
              바꾸기
            </button>
            {/* 해시를 보여 준다. 받는 쪽이 같은 값을 확인할 수 있어야 한다. */}
            <p className="num w-full truncate text-[10px] text-faint">SHA-256 {stage.sha}</p>
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
            <p className="text-xs text-ink">여기에 파일을 놓으세요</p>
            <p className="mt-1 text-[10px] text-faint">glb, gltf, fbx, obj, png, zip · 최대 2GB</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-5 cursor-pointer rounded-xl border border-line bg-transparent px-5 py-2.5 text-xs font-semibold text-muted hover:border-accent hover:text-ink"
            >
              파일 고르기
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

      {/* 2. 분석 — Unity 가 며칠 걸리는 자리다. 이게 이 제품이 파는 것이다. */}
      <Step n="02" title="분석" note="7항목 가중 합산">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-4">
            <b className="num text-4xl leading-none text-ink">{total}</b>
            <span className="num text-2xl text-accent">{badge}</span>
            {scores.license_clean < 60 && (
              <span className="text-xs text-accent">라이선스 출처가 60 미만이면 단독 탈락합니다</span>
            )}
          </div>

          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {CHECKS.map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <dt className="w-24 shrink-0 text-xs text-faint">{c.label}</dt>
                <dd className="m-0 flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={scores[c.key]}
                    onChange={(e) =>
                      setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))
                    }
                    aria-label={c.label}
                    className="min-w-0 flex-1 accent-[var(--accent)]"
                  />
                  <b className="num w-8 shrink-0 text-right text-xs text-ink">{scores[c.key]}</b>
                  <span className="num w-8 shrink-0 text-right text-[10px] text-faint">
                    {c.weight}%
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {/* 지금 이 값이 어디서 오는지 숨기지 않는다. */}
          <p className="mt-5 border-t border-line pt-4 text-[10px] leading-relaxed text-faint">
            실제 서비스에서는 올린 파일을 뜯어 서버가 채점합니다. 그 분석기가 아직
            붙어 있지 않아 지금은 이 화면에서 값을 정해 보냅니다. 가중치와 배지
            기준은 서버와 같은 값을 씁니다.
          </p>
        </div>
      </Step>

      {/* 3. 정보 */}
      <Step n="03" title="정보">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-faint">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
              placeholder="Gothic Statue"
            />
          </label>

          <Chips label="분류" value={category} onPick={setCategory} options={CATEGORIES} />
          <Chips
            label="엔진"
            value={engine}
            onPick={setEngine}
            options={ENGINES.map((e) => [e, e === "any" ? "가리지 않음" : e.toUpperCase()] as const)}
          />
          <Chips label="화풍" value={style} onPick={setStyle} options={STYLES} />
        </div>
      </Step>

      {/* 4. 가격 — 물건이 정해지기 전에 값을 못 매긴다. 그래서 마지막이다. */}
      <Step n="04" title="가격">
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
          {/* 수수료를 미리 보여 준다. 팔린 뒤에 알면 늦다. */}
          <p className="text-xs text-faint">
            수수료 8% · 하나 팔릴 때{" "}
            <b className="num text-ink">${((Number(price) || 0) * 0.92).toFixed(2)}</b> 받습니다
          </p>
        </div>
      </Step>

      {error && (
        <p role="alert" className="mt-8 rounded-xl border border-accent px-4 py-3 text-xs text-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void publish()}
        disabled={stage.at !== "ready" || !title.trim()}
        className="mt-8 w-full cursor-pointer rounded-xl border-0 bg-accent px-6 py-4 text-xs font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {stage.at === "publishing" ? "등록 중" : "등록하기"}
      </button>
      {stage.at === "idle" && (
        <p className="mt-3 text-center text-[10px] text-faint">파일을 먼저 올려 주세요</p>
      )}
    </main>
  );
}

/** 서버는 배지를 영문 키로 준다. 화면 말은 화면이 정한다. */
const BADGE_KO: Record<string, string> = {
  challenger: "챌린저",
  diamond: "다이아",
  platinum: "플래티넘",
  silver: "실버",
};

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
          {name}
        </button>
      ))}
    </div>
  );
}
