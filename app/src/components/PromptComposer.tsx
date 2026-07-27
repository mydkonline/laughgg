import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "../lib/locale";

/* 프롬프트 컴포저.

   AI 도구들의 입력 자리를 보고 뼈대를 가져왔다. 챗 UI 를 통째로 베끼지는
   않았는데, 여기가 대화가 아니기 때문이다 — 한 번 쓰고 결과를 보는 자리다.
   대화창을 얹으면 오갈 일도 없는 스레드에 말풍선만 쌓인다.

   가져온 것 (setproduct, "Designing AI chat interfaces" 의 composer 항목):

     한 상자      입력·첨부·전송이 테두리 하나 안에 있다. 흩어 놓으면
                  무엇을 눌러야 시작되는지가 안 보인다
     늘어나는 칸  내용만큼 커지고 한계에서 스크롤로 바뀐다
     첨부 먼저    올린 그림을 입력칸 위에 썸네일로 세운다
     ⌘↵ 전송      Enter 는 줄바꿈. 프롬프트는 여러 줄로 쓰는 글이라
                  Enter 로 보내면 문장 중간에 나간다
     단축키 표기  화면에 적어 둔다. 안 적으면 아무도 모른다

   안 가져온 것

     말풍선       주고받는 게 아니다
     멈춤 버튼    변환이 그 자리에서 끝난다. 멈출 시간이 없다
     대화 목록    프리셋으로 저장하는 자리가 따로 있다 */

/** 입력칸이 이보다 커지면 스크롤로 바뀐다. 화면을 다 먹으면 결과가 안 보인다. */
const MAX_ROWS_PX = 220;

export type Reference = {
  /** 화면에 띄울 objectURL. 쓰고 나면 반드시 revoke 한다. */
  url: string;
  name: string;
  /** 이 그림에서 뽑은 색. 없으면 아직 읽는 중이다. */
  colors: string[];
};

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  credits,
  free,
  refs,
  onAddRef,
  onDropRef,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  credits: number;
  free: number;
  refs: Reference[];
  onAddRef: (files: FileList) => void;
  onDropRef: (url: string) => void;
  /** 블록 조립기처럼 상자 안에 같이 들어가는 것 */
  children?: React.ReactNode;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  /* 내용만큼 키운다.

     높이를 먼저 0 으로 돌린 뒤 scrollHeight 를 읽는다. 안 그러면 한 번
     커진 칸이 다시 안 줄어든다 — scrollHeight 가 지금 높이를 포함해서다. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_ROWS_PX ? "auto" : "hidden";
  }, [value]);

  const send = useCallback(() => {
    if (disabled) return;
    onSubmit();
    // 보낸 뒤 포커스를 뺏지 않는다. 이어서 고쳐 쓰는 게 보통이다.
    box.current?.focus();
  }, [disabled, onSubmit]);

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        onAddRef(e.dataTransfer.files);
      }}
      className={[
        "flex flex-col rounded-2xl border bg-surface transition-colors",
        over ? "border-accent" : "border-line",
      ].join(" ")}
    >
      {/* 첨부가 먼저 온다. 입력칸 아래에 두면 무엇을 참고하는지 모르고 쓴다. */}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          {refs.map((r) => (
            <figure key={r.url} className="group relative m-0">
              <img
                src={r.url}
                alt={r.name}
                className="h-16 w-16 rounded-lg border border-line object-cover"
              />
              {/* 뽑은 색을 그림 아래에 깐다. 무엇을 가져갔는지 보여야 한다. */}
              <span className="mt-1 flex h-1.5 overflow-hidden rounded-full">
                {r.colors.map((c) => (
                  <b key={c} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <button
                type="button"
                onClick={() => onDropRef(r.url)}
                aria-label={t("{name} 빼기", { name: r.name })}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 cursor-pointer rounded-full border border-line bg-ground text-xs leading-none text-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink"
              >
                ×
              </button>
            </figure>
          ))}
        </div>
      )}

      <textarea
        ref={box}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter 는 줄바꿈이다. 여러 줄로 쓰는 글이라 그게 맞다.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={3}
        placeholder={t("이끼 낀 고딕 석상, 한쪽 팔이 부서진")}
        aria-label={t("프롬프트")}
        className="w-full resize-none border-0 bg-transparent px-4 pt-4 pb-2 text-xs leading-relaxed text-ink outline-none placeholder:text-faint"
      />

      {children && <div className="px-4 pb-1">{children}</div>}

      {/* 아래 줄. 왼쪽이 넣는 것, 오른쪽이 내보내는 것이다. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3 py-2.5">
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="cursor-pointer rounded-lg border border-line bg-transparent px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-ink"
        >
          {t("레퍼런스 이미지")}
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAddRef(e.target.files);
            // 같은 파일을 다시 고를 수 있어야 한다. 안 비우면 change 가 안 뜬다.
            e.target.value = "";
          }}
        />

        <span className="hidden text-[10px] text-faint sm:inline">
          {t("게임 화면을 올리면 그 색으로 맞춥니다")}
        </span>

        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-faint">
            {t("크레딧")} <b className="num text-ink">{credits}</b> / {free}
          </span>
          {/* 44px 이상. 엄지로 누르는 자리다. */}
          <button
            type="button"
            onClick={send}
            disabled={disabled}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-accent px-5 text-xs font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("적용")}
            <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-normal">⌘↵</kbd>
          </button>
        </span>
      </div>
    </div>
  );
}
