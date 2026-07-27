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
  /* 어느 축을 펴 둘 것인가. 첫 축을 열어 둔다 — 전부 닫아 두면 처음 온
     사람에게는 빈 줄만 보이고, 무엇을 고를 수 있는지가 안 드러난다. */
  const [openAxis, setAxis] = useState(BLOCK_GROUPS[0]?.[0] ?? "");

  const add = (id: string) => {
    if (!picked.includes(id)) onChange([...picked, id]);
  };
  const remove = (id: string) => onChange(picked.filter((x) => x !== id));

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
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-accent px-3 py-1 text-xs font-bold text-white"
              aria-label={t("{label} 빼기", { label: t(b.label) })}
            >
              {t(b.label)}
              <span className="opacity-70">✕</span>
            </button>
          );
        })}
      </div>

      {/* 재료.

         일곱 축을 전부 펼쳐 두니 이 상자만 541px 이 됐다 — 뷰포트의 75%다.
         오른쪽 칼럼 전체가 1,416px 이라 결과를 보려면 매번 스크롤해야 했다.

         축을 탭으로 접는다. 한 번에 한 축의 칩만 보이므로 일곱 줄이 두 줄이
         된다. 고른 게 있는 축에는 점을 찍어 둔다 — 접어 두면 어디에 뭘
         골랐는지 안 보이는 게 접기의 대가라서, 그것만 돌려준다.

         팔레트를 팝오버로 숨기는 방법도 있었는데 안 썼다. 여기는 끌어다
         놓는 자리고, 팝오버가 열린 채로 드래그를 시작할 수가 없다. */}
      <div className="mt-3 flex flex-wrap gap-1">
        {BLOCK_GROUPS.map(([axis, blocks]) => {
          const n = blocks.filter((b) => picked.includes(b.id)).length;
          return (
            <button
              key={axis}
              type="button"
              onClick={() => setAxis(axis)}
              aria-pressed={axis === openAxis}
              className={[
                "flex cursor-pointer items-center gap-1 rounded-lg border-0 px-2.5 py-1 text-xs",
                axis === openAxis
                  ? "bg-chrome-700 font-bold text-ink"
                  : "bg-transparent text-faint hover:text-ink",
              ].join(" ")}
            >
              {t(axis)}
              {n > 0 && <b className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex min-h-[34px] flex-wrap gap-1.5">
        {(BLOCK_GROUPS.find(([a]) => a === openAxis)?.[1] ?? []).map((b) => {
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
                "cursor-grab rounded-full border px-3 py-1 text-xs active:cursor-grabbing",
                on
                  ? "border-accent text-accent"
                  : "border-line text-muted hover:border-accent hover:text-ink",
              ].join(" ")}
            >
              {t(b.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
