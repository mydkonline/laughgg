import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, api } from "../lib/api";
import { logIn, signUp, useAccount } from "../lib/account";
import { t } from "../lib/locale";

/* 가입과 로그인.

   한 화면에서 모드만 바꾼다. 화면을 나누면 "계정이 없으신가요" 를 눌렀을 때
   방금 친 이메일이 사라진다.

   비밀번호 규칙은 서버가 정한다. 여기서 다시 적으면 둘이 갈릴 때 화면에는
   통과인데 서버가 거절하는 상태가 된다. 길이 하한만 미리 알려 준다 —
   그건 눌러 보기 전에 알아야 고칠 수 있다. */

type Mode = "join" | "login";

/* 구글 로고.

   브랜드 가이드가 네 가지 색을 그대로 쓰라고 해서 여기만 사이트 팔레트를
   벗어난다. 임의로 단색으로 칠하면 로고를 고친 게 되고, 그건 쓰면 안 된다.

   SVG 로 직접 그린다 — 이미지 파일을 두면 다크 배경에서 흰 테두리가 남고,
   CDN 을 걸면 그 요청 하나로 로그인 화면이 느려진다. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.3-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"
      />
    </svg>
  );
}

export function Join() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const auth = useAccount();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "login" ? "login" : "join");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인한 사람이 이 화면에 올 이유가 없다.
  if (auth.status === "signed") return <Navigate to="/market" replace />;

  const joining = mode === "join";
  const tooShort = password.length > 0 && password.length < 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (joining) await signUp(email, password, name);
      else await logIn(email, password);
      nav("/market", { replace: true });
    } catch (err) {
      /* 서버 문구를 그대로 띄우지 않는다. 영어로 오기도 하고, 무엇보다
         로그인 실패는 어느 쪽이 틀렸는지 알려 주면 안 된다 — 그게 곧
         가입자 명단이다. 서버도 뭉쳐서 주지만 화면에서도 뭉친다. */
      if (err instanceof ApiError && err.isConflict) {
        setError("이미 가입된 이메일입니다.");
      } else if (err instanceof ApiError && err.isAuth) {
        setError("이메일 또는 비밀번호가 맞지 않습니다.");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("이메일 형태와 비밀번호 길이를 확인해 주세요.");
      } else if (err instanceof ApiError && err.status === 0) {
        setError("서버에 닿지 못했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError("처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[420px] px-5 py-16">
      <p className="text-xs tracking-wide text-accent">{t("계정")}</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">{joining ? t("가입") : t("로그인")}</h1>
      <p className="mt-2 text-xs text-muted">
        {joining ? t("에셋을 올리고 산 것을 받으려면 계정이 필요합니다.") : t("가입한 계정으로 들어갑니다.")}
      </p>

      {/* 구글이 먼저다. 비밀번호를 새로 만들 이유가 없으면 안 만드는 게 낫다. */}
      <a
        href={api.googleUrl()}
        className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line py-3 text-xs font-semibold text-ink no-underline hover:border-accent"
      >
        <GoogleMark />
        {t("구글로 계속하기")}
      </a>

      <p className="my-6 flex items-center gap-3 text-[10px] text-faint">
        <span className="h-px flex-1 bg-line" />
        {t("또는")}
        <span className="h-px flex-1 bg-line" />
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-faint">{t("이메일")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
            placeholder="you@studio.gg"
          />
        </label>

        {joining && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-faint">
              {t("표시 이름")} <span className="text-faint">{t("선택")}</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
              placeholder={t("안 적으면 이메일 앞부분을 씁니다")}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-faint">{t("비밀번호")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={joining ? "new-password" : "current-password"}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink placeholder:text-faint focus:border-accent"
            placeholder={t("8자 이상")}
          />
          {/* 눌러 보기 전에 알려 준다. 서버까지 갔다 오면 고치기가 늦다. */}
          {joining && tooShort && (
            <span className="text-[10px] text-accent">{t("8자 이상이어야 합니다.")}</span>
          )}
        </label>

        {/* 오류는 버튼 바로 위에 둔다. 위쪽에만 띄우면 스크롤한 사람이 못 본다. */}
        {error && (
          <p role="alert" className="rounded-xl border border-accent px-4 py-3 text-xs text-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (joining && tooShort)}
          className="cursor-pointer rounded-xl border-0 bg-accent px-6 py-3.5 text-xs font-bold text-ground hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("처리 중") : joining ? t("가입하기") : t("로그인")}
        </button>
      </form>

      <p className="mt-6 text-xs text-faint">
        {joining ? `${t("이미 계정이 있나요?")} ` : `${t("계정이 없나요?")} `}
        <button
          type="button"
          onClick={() => {
            setMode(joining ? "login" : "join");
            setError(null);
          }}
          className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-accent hover:underline"
        >
          {joining ? t("로그인") : t("가입하기")}
        </button>
      </p>

      <p className="mt-10 border-t border-line pt-5 text-[10px] leading-relaxed text-faint">
        {t("비밀번호는 Argon2id 로 저장되며 원문은 어디에도 남지 않습니다. 세션은 서버가 들고 있어 로그아웃하면 그 자리에서 끊깁니다.")}{" "}
        <Link to="/market" className="text-faint underline">
          {t("그냥 둘러보기")}
        </Link>
      </p>
    </main>
  );
}
