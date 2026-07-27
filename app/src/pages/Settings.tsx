import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { logOut, useAccount } from "../lib/account";

/* 계정 설정.

   보여 줄 게 적을 때 빈 칸을 미리 만들어 두면 고장으로 읽힌다. 지금 되는
   것만 낸다 — 이메일과 로그인 수단 확인, 로그아웃.

   비밀번호 변경과 탈퇴는 API 가 아직 없다. 버튼을 만들어 두고 눌렀을 때
   아무 일도 안 일어나는 게 더 나쁘므로, 없다고 적는다. */
export function Settings() {
  const auth = useAccount();
  const [copied, setCopied] = useState(false);

  if (auth.status === "loading") {
    return <main className="mx-auto max-w-[560px] px-5 py-16 text-xs text-faint">불러오는 중</main>;
  }
  if (auth.status === "anon") return <Navigate to="/join?mode=login" replace />;

  const { account } = auth;

  return (
    <main className="mx-auto max-w-[560px] px-5 py-12">
      <p className="text-xs tracking-wide text-accent">계정</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">설정</h1>

      <section className="mt-8">
        <h2 className="text-base font-bold text-ink">내 정보</h2>
        <dl className="mt-4 border-t border-line">
          <Row k="표시 이름" v={account.display_name} />
          <Row k="이메일" v={account.email} />
          <Row k="로그인 수단" v={account.has_password ? "비밀번호" : "구글"} />
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 border-b border-line py-3">
            <dt className="text-xs text-faint">계정 번호</dt>
            <dd className="m-0 flex items-baseline gap-2 text-xs text-ink">
              <span className="num">{account.id}</span>
              {/* 문의할 때 이 번호를 대면 우리가 계정을 특정할 수 있다. */}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(String(account.id));
                  setCopied(true);
                }}
                className="cursor-pointer border-0 bg-transparent p-0 text-[10px] text-faint hover:text-ink"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-bold text-ink">요금</h2>
        <p className="mt-2 text-xs text-muted">구독과 크레딧 충전은 요금 화면에서 봅니다.</p>
        <Link
          to="/billing"
          className="mt-4 inline-block rounded-xl border border-line px-5 py-2.5 text-xs font-semibold text-muted no-underline hover:border-accent hover:text-ink"
        >
          요금 보기
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-bold text-ink">보안</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          비밀번호는 Argon2id 로 저장되며 원문은 어디에도 남지 않습니다. 세션은 서버가
          들고 있어 로그아웃하면 그 쿠키가 그 자리에서 끊깁니다.
        </p>
        <p className="mt-3 text-[10px] text-faint">
          비밀번호 변경과 계정 삭제는 아직 준비 중입니다.
        </p>
        <button
          type="button"
          onClick={() => void logOut()}
          className="mt-4 cursor-pointer rounded-xl border border-line bg-transparent px-5 py-2.5 text-xs font-semibold text-muted hover:border-accent hover:text-ink"
        >
          로그아웃
        </button>
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 border-b border-line py-3">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="m-0 truncate text-xs text-ink">{v}</dd>
    </div>
  );
}
