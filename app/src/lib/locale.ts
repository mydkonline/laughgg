import { useSyncExternalStore } from "react";

import { EN } from "../i18n/en";

/* 다국어.

   Laravel 의 codezero/laravel-localized-routes 를 보고 규칙을 그대로 가져왔다.
   그 패키지가 정한 것 중 여기서 지킨 게 셋이다.

     경로 첫 칸       `/en/market`. 언어가 주소에 있어야 링크를 그대로 넘길 수 있다
     기본 언어 생략   `omitted_locale` 과 같다. 한국어는 `/market` 이지 `/ko/market` 이 아니다
     주소 갈아타기    `Route::localizedUrl()` 처럼 지금 보던 자리를 그대로 옮긴다

   **기본 언어를 안 건드린다.** 화면에 적힌 한국어가 곧 키다. `t("마켓")` 은
   번역이 있으면 영어를, 없으면 적힌 한국어를 그대로 돌려준다. 그래서

     - 새 문구를 쓸 때 키를 먼저 만들 필요가 없다
     - 번역이 아직 없는 화면도 지금처럼 멀쩡히 뜬다
     - 한 화면씩 옮겨 갈 수 있다 — 다 옮길 때까지 기다리지 않는다

   `nav.market` 같은 키로 바꾸면 소스에서 무슨 말인지 안 보이고, 옮기는 중간에
   키만 있고 번역은 없는 화면이 생긴다. */

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** 주소에 안 붙는 언어. 한국어 주소는 지금 그대로다. */
export const BASE: Locale = "ko";

export const LOCALE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

/** 언어 선택 버튼에 적는 짧은 말. 두 글자면 폭이 안 흔들린다. */
export const LOCALE_SHORT: Record<Locale, string> = {
  ko: "KO",
  en: "EN",
};

/** 번역표. 기본 언어는 표가 없다 — 소스에 적힌 말이 곧 그 언어다. */
const TABLES: Partial<Record<Locale, Record<string, string>>> = { en: EN };

const KEY = "igg-locale";

/* 정하는 순서.

   패키지의 detectors 순서를 줄여서 가져왔다. 주소가 제일 세다 — 링크를 받은
   사람은 보낸 사람이 보던 언어로 봐야 한다. 그다음이 지난번 고른 것,
   마지막이 브라우저 설정이다. */
function detect(): Locale {
  const fromUrl = fromPath(window.location.pathname);
  if (fromUrl) return fromUrl;

  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* 시크릿 창에서는 못 읽는다. 다음 줄로 넘어간다. */
  }

  for (const want of navigator.languages ?? []) {
    const head = want.split("-")[0];
    if (isLocale(head)) return head;
  }
  return BASE;
}

function isLocale(v: string | null | undefined): v is Locale {
  return LOCALES.includes(v as Locale);
}

/* 앱이 올라가는 자리. GitHub Pages 는 /laughgg/ 아래다.

   `import.meta.env.BASE_URL` 은 항상 슬래시로 끝나므로 뒤를 떼어 둔다. */
const MOUNT = import.meta.env.BASE_URL.replace(/\/$/, "");

/** 주소에서 언어를 읽는다. 첫 칸이 언어가 아니면 기본 언어다. */
function fromPath(pathname: string): Locale | null {
  const rest = pathname.startsWith(MOUNT) ? pathname.slice(MOUNT.length) : pathname;
  const head = rest.split("/").filter(Boolean)[0];
  return isLocale(head) ? head : null;
}

/* 지금 언어는 첫 렌더 전에 정해진다.

   테마와 같은 이유다. 렌더 도중에 바뀌면 화면이 한 번 한국어로 그려졌다가
   영어로 다시 그려진다. */
const current: Locale = detect();

/** 라우터에 넘길 basename. 기본 언어면 언어 칸이 없다. */
export const ROUTER_BASE = current === BASE ? MOUNT : `${MOUNT}/${current}`;

/* 스토어라기엔 바뀌지 않는다.

   언어를 바꾸면 주소가 바뀌므로 페이지를 새로 연다. 라우터 basename 이
   언어에 묶여 있어서 그 자리에서 갈아 끼울 수가 없고, 굳이 할 이유도 없다 —
   언어 전환은 하루에 한 번 있을까 한 일이다. */
export function useLocale() {
  return useSyncExternalStore(
    () => () => {},
    () => current,
    () => BASE,
  );
}

export function locale(): Locale {
  return current;
}

/* 지금 보던 자리를 다른 언어로.

   패키지의 `Route::localizedUrl()` 과 같은 일이다. 첫 칸만 갈아 끼우고
   나머지 경로와 물음표 뒤는 그대로 둔다 — 홈으로 돌려보내면 열 쪽 넘겨
   찾아온 자리를 잃는다. */
export function switchTo(next: Locale): string {
  const { pathname, search, hash } = window.location;
  const rest = pathname.startsWith(MOUNT) ? pathname.slice(MOUNT.length) : pathname;
  const parts = rest.split("/").filter(Boolean);
  if (isLocale(parts[0])) parts.shift();

  const prefix = next === BASE ? "" : `/${next}`;
  const tail = parts.length > 0 ? `/${parts.join("/")}` : "/";
  return `${MOUNT}${prefix}${tail}${search}${hash}`;
}

/** 고른 언어를 기억한다. 다음에 주소 없이 들어와도 그 언어로 연다. */
export function remember(next: Locale) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* 저장이 막혀도 이번 이동은 주소로 정해진다. */
  }
}

/* 문구 하나.

   키가 곧 한국어다. 번역이 없으면 적힌 그대로 나간다 — 빈 화면이나
   `nav.market` 같은 게 뜨는 일이 없다.

   `{n}` 자리를 채운다. 문장을 잘라 이어 붙이면 언어마다 어순이 달라
   말이 안 되므로, 자리만 비워 두고 통째로 번역한다. */
export function t(ko: string, vars?: Record<string, string | number>): string {
  const table = TABLES[current];
  const hit = table?.[ko];

  /* `t()` 로 감쌌는데 번역이 없는 것을 적어 둔다.

     개발 중에만 한다. 아직 `t()` 로 감싸지도 않은 문구는 여기 안 잡힌다 —
     그건 소스에 그대로 있는 한국어라 화면을 봐야 안다. 여기 모이는 건
     "옮기기로 정해 놓고 번역만 빠진 것" 이고, 그게 제일 놓치기 쉽다. */
  if (import.meta.env.DEV && table && hit === undefined) missing.add(ko);

  let out = hit ?? ko;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

/** 번역표에 없던 키. 개발 빌드에서만 찬다. */
export const missing = new Set<string>();
if (import.meta.env.DEV) {
  (globalThis as { __laughggMissing?: Set<string> }).__laughggMissing = missing;
}
