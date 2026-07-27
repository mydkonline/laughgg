import { BASE, locale } from "./locale";

/** 가격 표기. 0 이면 무료로 쓴다 — "$0" 은 파는 물건처럼 안 읽힌다. */
export function won(usd: number): string {
  return usd === 0 ? "무료" : `$${usd}`;
}

/** 천 단위 구분. 표 안에서 자리가 맞도록 tabular-nums 와 같이 쓴다. */
export function num(n: number): string {
  return n.toLocaleString("ko-KR");
}

/* 만원 단위 금액.

   한국어는 "6,027만원" 이 그대로 읽힌다. 영어는 그 단위가 없다.

   처음엔 `만원` 을 "0K KRW" 로 옮겨서 숫자 뒤에 붙였는데, `6,027` + `0K KRW`
   가 `6,0270K KRW` 로 나왔다. 자릿수가 통째로 깨진다 — 단위가 자릿수를
   품고 있으면 접미사로 뗄 수가 없다. 값을 바꿔서 적어야 한다. */
export function manwon(v: number): string {
  if (locale() === BASE) return `${v.toLocaleString("ko-KR")}만원`;
  const krw = v * 10_000;
  if (krw >= 100_000_000) return `${(krw / 100_000_000).toFixed(2).replace(/\.?0+$/, "")}B KRW`;
  if (krw >= 1_000_000) return `${(krw / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M KRW`;
  return `${(krw / 1_000).toFixed(0)}K KRW`;
}
