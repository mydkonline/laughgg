import { useCallback, useSyncExternalStore } from "react";

/* 장바구니.

   localStorage 에 둔다. 새로고침을 넘겨야 하고, 로그인 전에 담아 두는
   경우가 있어서 서버에만 두면 담은 것이 사라진다.

   **수량이 없다.** 파는 것이 파일이라 같은 것을 두 개 사도 받는 게 같다.
   그래서 담긴 것은 집합이고, 화면에도 수량 조절이 없다 — 일반적인 쇼핑몰
   장바구니를 그대로 베끼면 여기 있는 게 이상하다.

   "나중에" 를 따로 둔다. 지금은 안 사지만 지우기도 아까운 것을 담아 두는
   자리다. 이게 없으면 결제 직전에 망설이는 줄을 지우는 것 말고 할 수 있는
   게 없고, 지운 건 다시 못 찾는다. */

const CART_KEY = "igg-cart";
const LATER_KEY = "igg-cart-later";

const subs = new Set<() => void>();

let ids: number[] = load(CART_KEY);
let later: number[] = load(LATER_KEY);
let snapshot = { ids, later, count: ids.length };

function load(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function save(key: string, v: number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 사파리 시크릿처럼 저장이 막힌 자리가 있다. 이번 세션은 유지한다. */
  }
}

function commit(nextIds: number[], nextLater: number[]) {
  ids = nextIds;
  later = nextLater;
  snapshot = { ids, later, count: ids.length };
  save(CART_KEY, ids);
  save(LATER_KEY, later);
  subs.forEach((cb) => cb());
}

const EMPTY = { ids: [] as number[], later: [] as number[], count: 0 };

export function useCart() {
  const state = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => snapshot,
    // 서버 렌더에는 localStorage 가 없다. 같은 객체를 돌려줘야 루프가 안 돈다.
    () => EMPTY,
  );

  /* 아래 콜백들은 모듈 변수를 읽는다. 의존성이 비어 있어도 최신 값을 본다 —
     이 스토어가 컴포넌트 트리 밖에 있는 이유다. */
  const add = useCallback((id: number) => {
    if (!ids.includes(id)) commit([...ids, id], later.filter((x) => x !== id));
  }, []);

  const remove = useCallback(
    (id: number) => commit(ids.filter((x) => x !== id), later),
    [],
  );

  const has = useCallback((id: number) => ids.includes(id), []);

  /** 지금은 안 산다. 지우는 것과 다르다 — 담아 둔 걸 잃지 않는다. */
  const keepForLater = useCallback((id: number) => {
    commit(
      ids.filter((x) => x !== id),
      later.includes(id) ? later : [...later, id],
    );
  }, []);

  const moveToCart = useCallback((id: number) => {
    commit(ids.includes(id) ? ids : [...ids, id], later.filter((x) => x !== id));
  }, []);

  const dropLater = useCallback(
    (id: number) => commit(ids, later.filter((x) => x !== id)),
    [],
  );

  /* 결제가 끝난 것만 비운다. 통째로 비우는 버튼은 안 만들었다 — 실수로
     누르면 되돌릴 방법이 없고, 한 줄씩 빼는 것보다 급한 일이 아니다. */
  const settled = useCallback((bought: number[]) => {
    commit(ids.filter((x) => !bought.includes(x)), later);
  }, []);

  return { ...state, add, remove, has, keepForLater, moveToCart, dropLater, settled };
}
