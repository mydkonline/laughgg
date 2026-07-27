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

/* 서버에 한 번 물어본다.

   쿠키는 자바스크립트가 못 읽는다(HttpOnly). 그래서 로그인했는지는 서버만
   안다 — 물어보는 것 말고 방법이 없다. */
let asked = false;
export function loadAccount() {
  if (asked) return;
  asked = true;
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
  const account = await api.logIn(email, password);
  set({ status: "signed", account });
  return account;
}

export async function logOut() {
  await api.logOut().catch(() => {
    // 서버가 안 받아 줘도 화면에서는 나간 것으로 둔다. 쿠키는 이미
    // 만료 요청이 갔고, 안 나가진 채로 남는 게 더 나쁘다.
  });
  set({ status: "anon" });
}
