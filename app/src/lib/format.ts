/** 가격 표기. 0 이면 무료로 쓴다 — "$0" 은 파는 물건처럼 안 읽힌다. */
export function won(usd: number): string {
  return usd === 0 ? "무료" : `$${usd}`;
}

/** 천 단위 구분. 표 안에서 자리가 맞도록 tabular-nums 와 같이 쓴다. */
export function num(n: number): string {
  return n.toLocaleString("ko-KR");
}
