import { useCallback, useSyncExternalStore } from "react";

/* 장바구니는 새로고침을 넘겨야 하므로 localStorage 에 둔다.
   페이지가 여럿이라 컴포넌트 트리 밖에 스토어를 두고 구독만 시킨다. */
const KEY = "igg-cart";
const subs = new Set<() => void>();

let ids: number[] = load();
let snapshot = { ids, count: ids.length };

function load(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function commit(next: number[]) {
  ids = next;
  snapshot = { ids, count: ids.length };
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* 저장이 막혀도 이번 세션 상태는 유지한다 */
  }
  subs.forEach((cb) => cb());
}

const EMPTY = { ids: [] as number[], count: 0 };

export function useCart() {
  const state = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => snapshot,
    () => EMPTY,
  );

  const add = useCallback((id: number) => {
    if (!ids.includes(id)) commit([...ids, id]);
  }, []);
  const remove = useCallback((id: number) => commit(ids.filter((x) => x !== id)), []);
  const has = useCallback((id: number) => ids.includes(id), []);

  return { ...state, add, remove, has };
}
