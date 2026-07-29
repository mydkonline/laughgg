import { useState } from "react";
import { t } from "../lib/locale";

/* 프롬프트를 블록으로 조립한다.

   빈 입력창은 무엇을 쓸 수 있는지 알려 주지 않는다. 쓸 수 있는 말을 전부 꺼내
   놓고 끌어다 놓게 하면, 어휘를 배우면서 문장이 만들어진다.

   조립 결과는 결국 같은 문자열이라 기존 프롬프트 해석기를 그대로 탄다 —
   직접 타자를 쳐도 되고 블록을 써도 된다. */

export type Block = { id: string; label: string; word: string };

/** 축마다 쓸 수 있는 말. 프롬프트 규칙이 실제로 읽는 단어만 올린다. */
export const BLOCK_GROUPS: [string, Block[]][] = [
  ["분위기", [
    { id: "dark", label: "어둡게", word: "어둡고 축축한" },
    { id: "bright", label: "밝게", word: "밝고 화사한" },
    { id: "night", label: "밤", word: "밤" },
  ]],
  ["색온도", [
    { id: "warm", label: "따뜻하게", word: "따뜻한 노을빛" },
    { id: "cold", label: "차갑게", word: "차갑고 서늘한" },
  ]],
  ["재질", [
    { id: "metal", label: "금속", word: "금속 반사" },
    { id: "matte", label: "무광", word: "거칠고 낡은 무광" },
  ]],
  ["면", [
    { id: "lowpoly", label: "로우폴리", word: "로우폴리" },
    { id: "toon", label: "만화", word: "만화 외곽선" },
  ]],
  ["색", [
    { id: "vivid", label: "쨍하게", word: "쨍한 색" },
    { id: "faded", label: "빛바래게", word: "빛바랜" },
  ]],
  ["팔레트", [
    { id: "gb", label: "게임보이", word: "게임보이 초록 4색" },
    { id: "pico", label: "PICO-8", word: "pico 16색" },
    { id: "cga", label: "CGA", word: "cga 4색" },
    { id: "onebit", label: "1비트", word: "1비트 흑백" },
    { id: "ink", label: "잉크", word: "잉크 느와르" },
    { id: "sepia", label: "세피아", word: "세피아" },
    { id: "neon", label: "네온", word: "네온 사이버" },
    { id: "moss", label: "이끼", word: "이끼 낀 던전" },
    { id: "ember", label: "잿불", word: "용암 대장간" },
  ]],
  ["도트", [
    { id: "big", label: "굵은 도트", word: "굵은 도트" },
    { id: "fine", label: "고운 도트", word: "고운 도트" },
    { id: "dither", label: "디더링", word: "디더링" },
  ]],
];

const ALL = BLOCK_GROUPS.flatMap(([, b]) => b);

/** 고른 블록을 문장으로 잇는다. 쉼표로만 이어도 규칙이 다 읽는다. */
export function toPrompt(ids: string[]): string {
  return ids
    .map((id) => ALL.find((b) => b.id === id)?.word)
    .filter(Boolean)
    .join(", ");
}

export function PromptBuilder({
  picked,
  onChange,
}: {
  picked: string[];
  onChange: (next: string[]) => void;
}) {
  const [over, setOver] = useState(false);
  /* 키워드도 카테고리도 늘어날 수 있어 검색을 앞에 둔다. 비우면 카테고리별로
     다 보이고, 치면 전 카테고리에서 맞는 블록만 뜬다. */
  const [query, setQuery] = useState("");

  const add = (id: string) => {
    if (!picked.includes(id)) onChange([...picked, id]);
  };
  const remove = (id: string) => onChange(picked.filter((x) => x !== id));

  /* 검색은 라벨(현재 언어와 원문)과 실제 들어가는 말 모두를 훑는다. */
  const q = query.trim().toLowerCase();
  const matches = q
    ? ALL.filter((b) => `${t(b.label)} ${b.label} ${b.word}`.toLowerCase().includes(q))
    : null;

  /* 끌 수 있는 블록 하나. 검색 결과와 카테고리 목록이 같은 칩을 쓴다. */
  const chip = (b: Block) => {
    const on = picked.includes(b.id);
    return (
      <button
        key={b.id}
        type="button"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", b.id)}
        onClick={() => (on ? remove(b.id) : add(b.id))}
        aria-pressed={on}
        title={t(b.word)}
        className={[
          "cursor-grab rounded-full border px-3 py-1.5 text-xs active:cursor-grabbing",
          on ? "border-accent text-accent" : "border-line text-muted hover:border-accent hover:text-ink",
        ].join(" ")}
      >
        {t(b.label)}
      </button>
    );
  };

  return (
    <div>
      {/* 놓는 자리. 비어 있어도 무엇을 놓는 곳인지 보여야 한다. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const id = e.dataTransfer.getData("text/plain");
          if (id) add(id);
        }}
        className={[
          /* 직접 입력칸과 같은 자리에 오므로 같은 생김새를 쓴다 — 바탕을
             한 단계 어둡게 눕히고 테두리를 두른다. 점선인 건 여기가
             "놓는 자리" 라서다. 쓰는 칸과 놓는 칸을 선으로 구분한다. */
          "flex min-h-[92px] flex-wrap items-start content-start gap-1.5 rounded-xl border border-dashed bg-ground p-3 transition-colors",
          over ? "border-accent bg-accent-soft" : "border-line",
        ].join(" ")}
      >
        {picked.length === 0 && (
          <span className="px-1 text-xs text-faint">{t("아래에서 끌어다 놓거나 눌러서 담으세요")}</span>
        )}
        {picked.map((id) => {
          const b = ALL.find((x) => x.id === id);
          if (!b) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => remove(id)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-accent px-3 py-1 text-xs font-bold text-ground"
              aria-label={t("{label} 빼기", { label: t(b.label) })}
            >
              {t(b.label)}
              <span className="opacity-70">✕</span>
            </button>
          );
        })}
      </div>

      {/* 재료 팔레트. 키워드도 카테고리도 늘어날 수 있어 검색을 앞에 둔다 —
         커맨드 팔레트/이모지 피커 방식이다. 검색하면 전 카테고리에서 맞는 블록이
         뜨고, 비우면 카테고리별로 묶어 보여 준다. 높이를 고정해 안에서만 스크롤
         하므로 카테고리가 수십 개로 늘어도 이 상자가 화면을 삼키지 않는다. */}
      <div className="mt-4 rounded-xl border border-line bg-ground p-2.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("블록 찾기")}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="mt-2 max-h-[224px] overflow-y-auto pr-1 [scrollbar-width:thin]">
          {matches ? (
            <div className="flex flex-wrap gap-2 py-1">
              {matches.length ? (
                matches.map(chip)
              ) : (
                <span className="px-1 py-2 text-xs text-faint">{t("맞는 블록이 없습니다")}</span>
              )}
            </div>
          ) : (
            BLOCK_GROUPS.map(([axis, blocks]) => {
              const n = blocks.filter((b) => picked.includes(b.id)).length;
              return (
                <div key={axis} className="mb-1">
                  {/* 카테고리 머리는 스크롤 위에 붙어, 어느 축을 보는지 항상 보인다. */}
                  <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-ground py-1.5 text-[10px] font-bold tracking-wide text-faint">
                    {t(axis)}
                    {n > 0 && <b className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </div>
                  <div className="flex flex-wrap gap-2 pb-2">{blocks.map(chip)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
