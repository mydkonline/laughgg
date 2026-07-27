import { useMemo, useState } from "react";
import { TARGETS, FORMATS, formatOf, estimateSize, type FileKind } from "../data/formats";
import { t } from "../lib/locale";

/* 내보내기 고르기.

   형식 열아홉 개를 한 줄에 늘어놓으면 아무도 못 고른다. 사는 사람이 아는 건
   확장자가 아니라 자기 엔진이라, 대상을 먼저 고르게 하고 형식은 그 결과로 정해진다.
   확장자를 직접 만지고 싶은 사람만 아래를 편다. */

const KIND_LABEL: Record<FileKind, string> = {
  "3d": "모델",
  "2d": "이미지",
  tex: "텍스처",
  pack: "패키지",
};

export function ExportPicker({
  tex,
  target,
  onTarget,
  picks,
  onPicks,
}: {
  /** 상품의 텍스처 해상도. 용량 어림에 쓴다. */
  tex: string;
  target: string;
  onTarget: (id: string) => void;
  picks: string[];
  onPicks: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<FileKind, typeof FORMATS>();
    for (const f of FORMATS) m.set(f.kind, [...(m.get(f.kind) ?? []), f]);
    return [...m];
  }, []);

  const toggle = (ext: string) =>
    onPicks(picks.includes(ext) ? picks.filter((x) => x !== ext) : [...picks, ext]);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xs font-bold text-ink">{t("내보내기")}</h2>
        <span className="text-xs text-faint">{t("엔진을 고르면 형식이 정해집니다")}</span>
      </div>

      {/* 라벨이 먼저다. 칩만 늘어놓으면 이게 무엇을 고르는 줄인지 모른다. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 shrink-0 text-xs text-faint">{t("엔진")}</span>
        {TARGETS.map((tg) => (
          <button
            key={tg.id}
            type="button"
            onClick={() => {
              onTarget(tg.id);
              onPicks(tg.picks);
            }}
            aria-pressed={target === tg.id}
            title={t(tg.who)}
            className={[
              "cursor-pointer rounded-full border px-3 py-1 text-xs",
              target === tg.id
                ? "border-transparent bg-ink font-bold text-ground"
                : "border-line text-muted hover:border-accent hover:text-ink",
            ].join(" ")}
          >
            {t(tg.name)}
          </button>
        ))}
      </div>

      {/* 고른 결과. 확장자와 용량이 보여야 무엇을 받는지 안다. */}
      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 border-t border-line p-0 pt-3">
        {picks.map((e) => {
          const f = formatOf(e);
          if (!f) return null;
          return (
            <li key={e} className="flex items-baseline gap-2.5 text-xs">
              <span className="w-24 shrink-0 font-semibold text-ink">{t(f.name)}</span>
              <span className="min-w-0 flex-1 truncate text-faint">{t(f.holds)}</span>
              {f.caveat && <span className="shrink-0 text-[10px] text-accent">{t(f.caveat)}</span>}
            </li>
          );
        })}
        {picks.length === 0 && <li className="text-xs text-faint">{t("고른 형식이 없습니다.")}</li>}
      </ul>

      <p className="mt-3 flex items-baseline gap-2 text-xs text-faint">
        {t("받는 용량")}
        <b className="num text-base text-ink">{estimateSize(picks, tex)}</b>
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-xs text-faint hover:text-ink"
      >
        {t(open ? "형식 직접 고르기 닫기" : "형식 직접 고르기 열기")}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
          {grouped.map(([kind, list]) => (
            <div key={kind} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-xs text-faint">{t(KIND_LABEL[kind])}</span>
              {list.map((f) => {
                const on = picks.includes(f.ext);
                return (
                  <button
                    key={f.ext}
                    type="button"
                    onClick={() => toggle(f.ext)}
                    aria-pressed={on}
                    title={t(f.caveat ?? f.holds)}
                    className={[
                      "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs",
                      on ? "border-accent text-accent" : "border-line text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {t(f.name)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
