import { useSyncExternalStore } from "react";

import { ApiError, api, type Account } from "./api";

/* 로그인 상태.

   컴포넌트 트리 밖에 둔다. 네비게이션과 회원가입 화면이 같은 값을 봐야
   하는데, 컨텍스트로 넘기면 그 사이 모든 화면이 provider 를 알아야 한다.
   장바구니·테마와 같은 방식이다.

   세 가지 상태를 구분한다.
     loading  아직 서버에 안 물어봤다
     signed   로그인했다
     anon     안 했다
   처음 둘을 뭉치면 새로고침 직후 잠깐 "로그인" 버튼이 떴다가 사라진다. */

export type AuthState =
  | { status: "loading" }
  | { status: "signed"; account: Account }
  | { status: "anon" };

let state: AuthState = { status: "loading" };
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  for (const l of listeners) l();
}

/* 관리자 데모 로그인 (정적 배포용 폴백).

   로그인의 정식 경로는 서버다 — API 가 argon2 로 검증하고 세션을 발급한다.
   백엔드에는 같은 자격이 seed_admin 으로 심겨 있어, API 를 띄운 곳에서는
   이 우회를 안 거치고 진짜로 로그인된다.

   그런데 배포된 GitHub Pages 는 정적이라 API 가 없다 — /api/auth/login 을
   불러 봐야 github.io 가 404 를 주고, 그게 화면의 '처리하지 못했습니다' 다.
   그 자리에서도 데모를 보여 줘야 해서, 이 한 자격만 서버를 건너뛰고 그
   자리에서 통과시킨다. 서버가 있든 없든 무조건 로그인된다.

   자격은 백엔드 seed_admin 과 같은 값으로 맞춰 둔다 — 한쪽만 바꾸면 API 가
   도는 환경과 정적 배포에서 서로 다른 비번이 되는 사고가 난다.

   비번을 코드에 박는 건 보통 하면 안 되지만, 여기는 CC0 에셋 포트폴리오
   데모고 이 자격으로 열리는 백엔드가 배포돼 있지 않아 지킬 데이터가 없다.
   진짜 서버를 공개로 띄우면 이 우회는 지우고 seed 쪽만 남겨야 한다. */
const ADMIN_EMAIL = "admin@laughgg.io";
const ADMIN_PASSWORD = "laughgg-admin-2026";
const ADMIN_ACCOUNT: Account = {
  id: 1,
  email: ADMIN_EMAIL,
  display_name: "Admin",
  has_password: true,
};

/* 새로고침해도 로그인이 유지되게 표시를 남긴다. 서버 세션이 아니라
   이 브라우저에만 있는 표시다. */
const ADMIN_FLAG = "laughgg_admin_session";

function isAdmin(email: string, password: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

function restoreAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_FLAG) === "1";
  } catch {
    return false;
  }
}

/* 서버에 한 번 물어본다.

   쿠키는 자바스크립트가 못 읽는다(HttpOnly). 그래서 로그인했는지는 서버만
   안다 — 물어보는 것 말고 방법이 없다. */
let asked = false;
export function loadAccount() {
  if (asked) return;
  asked = true;
  // 이 브라우저에 관리자 표시가 남아 있으면 서버에 안 물어보고 바로 통과한다.
  if (restoreAdmin()) {
    set({ status: "signed", account: ADMIN_ACCOUNT });
    return;
  }
  api
    .me()
    .then((account) => set({ status: "signed", account }))
    .catch((e) => {
      // 401 은 정상이다. 안 했다는 뜻이지 실패가 아니다.
      if (!(e instanceof ApiError) || e.isAuth || e.status === 0) {
        set({ status: "anon" });
      } else {
        set({ status: "anon" });
      }
    });
}

export function useAccount(): AuthState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      loadAccount();
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export async function signUp(email: string, password: string, displayName?: string) {
  const account = await api.signUp(email, password, displayName);
  set({ status: "signed", account });
  return account;
}

export async function logIn(email: string, password: string) {
  /* 관리자 자격이면 서버를 건너뛴다 — 정적 배포엔 서버가 없어도 무조건
     통과해야 하므로 API 실패에 걸리게 두면 안 된다. API 가 도는 곳에서도
     이쪽으로 빠지지만, 백엔드에 같은 계정이 시드돼 있어 결과는 같다. */
  if (isAdmin(email, password)) {
    try {
      localStorage.setItem(ADMIN_FLAG, "1");
    } catch {
      // 저장이 막혀도(프라이빗 모드 등) 이번 세션은 로그인된다.
    }
    set({ status: "signed", account: ADMIN_ACCOUNT });
    return ADMIN_ACCOUNT;
  }
  const account = await api.logIn(email, password);
  set({ status: "signed", account });
  return account;
}

export async function logOut() {
  try {
    localStorage.removeItem(ADMIN_FLAG);
  } catch {
    // 무시. 아래에서 화면 상태는 어차피 anon 으로 내린다.
  }
  await api.logOut().catch(() => {
    // 서버가 안 받아 줘도 화면에서는 나간 것으로 둔다. 쿠키는 이미
    // 만료 요청이 갔고, 안 나가진 채로 남는 게 더 나쁘다.
  });
  set({ status: "anon" });
}
