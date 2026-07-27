import { Link, Navigate } from "react-router-dom";

import { logOut, useAccount } from "../lib/account";

/* 내 계정.

   지금은 보여 줄 게 적다. 라이브러리와 주문은 API 가 준비돼 있지만 화면이
   아직 없어서, 있는 것만 낸다 — 빈 칸을 미리 만들어 두면 고장으로 읽힌다. */
export function Me() {
  const auth = useAccount();

  if (auth.status === "loading") {
    return <main className="mx-auto max-w-[560px] px-5 py-16 text-xs text-faint">불러오는 중</main>;
  }
  if (auth.status === "anon") return <Navigate to="/join?mode=login" replace />;

  const { account } = auth;

  return (
    <main className="mx-auto max-w-[560px] px-5 py-16">
      <p className="text-xs tracking-wide text-accent">계정</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">{account.display_name}</h1>

      <dl className="mt-8 border-t border-line">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-line py-3">
          <dt className="text-xs text-faint">이메일</dt>
          <dd className="m-0 text-xs text-ink">{account.email}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-line py-3">
          <dt className="text-xs text-faint">로그인 수단</dt>
          <dd className="m-0 text-xs text-ink">
            {account.has_password ? "비밀번호" : "구글"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/upload"
          className="rounded-xl bg-accent px-5 py-3 text-xs font-bold text-white no-underline hover:bg-accent-strong"
        >
          에셋 올리기
        </Link>
        <button
          type="button"
          onClick={() => void logOut()}
          className="cursor-pointer rounded-xl border border-line bg-transparent px-5 py-3 text-xs font-semibold text-muted hover:border-accent hover:text-ink"
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}
