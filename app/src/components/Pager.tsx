/* 쪽 번호.

   무한 스크롤 대신 쪽을 쓴다. 목록이 길어지면 "어디쯤 왔는지" 와 "돌아갈 수
   있는지" 가 필요한데, 무한 스크롤은 둘 다 못 준다.

   쪽수가 많아지면 앞뒤 두 칸만 남기고 줄인다. 200쪽을 다 그릴 수는 없다. */
export function Pager({
  total,
  page,
  perPage,
  onGo,
}: {
  total: number;
  page: number;
  perPage: number;
  onGo: (p: number) => void;
}) {
  const last = Math.ceil(total / perPage);
  if (last <= 1) return null;

  const nums = Array.from({ length: last }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === last || Math.abs(p - page) <= 2,
  );

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1" aria-label="쪽 넘기기">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onGo(page - 1)}
        className="cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-xs text-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        이전
      </button>

      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - nums[i - 1]! > 1 && <span className="px-1 text-xs text-faint">…</span>}
          <button
            type="button"
            onClick={() => onGo(p)}
            aria-current={p === page ? "page" : undefined}
            className={[
              "num min-w-7 cursor-pointer rounded border-0 px-2 py-1 text-xs",
              p === page ? "bg-accent text-white" : "bg-transparent text-muted hover:text-ink",
            ].join(" ")}
          >
            {p}
          </button>
        </span>
      ))}

      <button
        type="button"
        disabled={page === last}
        onClick={() => onGo(page + 1)}
        className="cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-xs text-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        다음
      </button>
    </nav>
  );
}
