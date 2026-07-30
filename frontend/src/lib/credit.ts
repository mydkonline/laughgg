import { useCallback, useSyncExternalStore } from "react";

/* 크레딧. 프롬프트 적용 한 번에 1 크레딧을 쓴다.

   무료 횟수를 넘긴 요청만 과금하는 게 수익 구조라, 화면에서도 그렇게 보여야
   한다. 잔량이 안 보이면 사용자는 자기가 무엇을 쓰고 있는지 모른다.

   시연 단계라 브라우저 안에서만 센다. */

const KEY = "igg-credit";
const FREE = 20;
const subs = new Set<() => void>();

function load(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw === null ? FREE : Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : FREE;
  } catch {
    return FREE;
  }
}

let left = load();

function commit(next: number) {
  left = Math.max(0, next);
  try {
    localStorage.setItem(KEY, String(left));
  } catch {
    /* 저장이 막혀도 이번 세션은 굴러간다 */
  }
  subs.forEach((cb) => cb());
}

export function useCredit() {
  const remaining = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => left,
    () => FREE,
  );

  /** 한 번 쓴다. 남은 게 없으면 false 를 주고 아무것도 하지 않는다. */
  const spend = useCallback((n = 1) => {
    if (left < n) return false;
    commit(left - n);
    return true;
  }, []);

  const reset = useCallback(() => commit(FREE), []);

  return { remaining, free: FREE, spend, reset };
}
