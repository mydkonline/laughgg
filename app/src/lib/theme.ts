import { useCallback, useSyncExternalStore } from "react";

/* 테마는 <head> 부팅 스크립트가 첫 페인트 전에 이미 정해 뒀다.
   여기서는 그 값을 읽고 뒤집는 일만 한다. 기본은 다크다. */
export type Theme = "dark" | "light";

const KEY = "igg-theme";
const subs = new Set<() => void>();

function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    read,
    () => "dark" as Theme,
  );

  const toggle = useCallback(() => {
    const next: Theme = read() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 시크릿 창에서는 저장이 막힌다. 이번 세션만 적용하고 넘어간다. */
    }
    subs.forEach((cb) => cb());
  }, []);

  return { theme, toggle };
}
