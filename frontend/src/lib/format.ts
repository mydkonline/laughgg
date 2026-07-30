import { BASE, locale } from "./locale";

/** 가격 표기. 0 이면 무료로 쓴다 — "$0" 은 파는 물건처럼 안 읽힌다. */
export function won(usd: number): string {
  return usd === 0 ? "무료" : `$${usd}`;
}

/** 천 단위 구분. 표 안에서 자리가 맞도록 tabular-nums 와 같이 쓴다. */
export function num(n: number): string {
  return n.toLocaleString("ko-KR");
}

/* 환율 — 가정값이다.

   원과 달러 사이 환율은 매일 움직인다. 그래서 이건 인용값이 아니라 우리가
   세운 가정이고, IR 규칙상 화면에 가정으로 명시해야 한다(`FX_AS_OF` 를 같이
   띄운다). 실제 숫자를 바꿀 일이 생기면 여기 한 곳만 고치면 원화로 적힌 모든
   금액이 따라 움직인다. */
export const FX_KRW_PER_USD = 1_380;
export const FX_AS_OF = "2026-07";

/* 만원 단위 금액을, 보는 언어의 통화로 적는다.

   한국어는 원(만원/억원)으로 그대로 둔다. 영어는 단위만 M/B 로 바꾸는 게
   아니라 통화 자체를 달러로 바꾼다 — 위 환율로 환산한 뒤 $ 로 적는다.
   "6,027만원" 이 영어에서 "60.27M KRW" 로 남으면 읽는 사람은 여전히 원화를
   본다. 통화가 바뀌어야 자기 화폐로 읽힌다.

   입력 v 는 만원 단위다(6027 = 6,027만원 = 60,270,000원). */
export function manwon(v: number): string {
  // 부호를 떼고 크기만 포맷한 뒤 다시 붙인다 — 비관 시나리오 같은 음수도
  // "-2.4억원" / "-$174K" 로 자연스럽게 읽힌다.
  const neg = v < 0;
  const a = Math.abs(v);
  const body = (() => {
    if (locale() === BASE) {
      // 1만만원 = 1억원. 억 단위가 넘으면 억원으로 올려 읽는다.
      if (a >= 10_000) return `${(a / 10_000).toFixed(1).replace(/\.0$/, "")}억원`;
      return `${a.toLocaleString("ko-KR")}만원`;
    }
    const usd = (a * 10_000) / FX_KRW_PER_USD;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return `$${Math.round(usd).toLocaleString("en-US")}`;
  })();
  return neg ? `-${body}` : body;
}

/* 달러로 인용된 금액(시장 규모 등). 이건 환산이 아니다 — 출처가 달러다.
   한국어는 "억 달러", 영어는 "$B" 로 같은 값을 통화만 그대로 적는다. */
export function usdBillions(b: number): string {
  if (locale() === BASE) return `${b}억 달러`;
  return `$${(b / 10).toFixed(b % 10 === 0 ? 0 : 1)}B`;
}

/* 만 명 단위 인원.

   "만" 은 자릿수라 통화와 같은 문제를 낸다 — "500" 과 "만 명" 을 따로 옮기면
   "500" + "0K people" 가 붙어 "5000K people" 이 된다. 자릿수는 숫자로 곱해서
   합친 뒤 영어 표기(M/K)를 만든다. 입력 v 는 만 단위다(500 = 500만 = 5,000,000). */
export function peopleMan(v: number): string {
  if (locale() === BASE) return `${v.toLocaleString("ko-KR")}만 명`;
  const people = v * 10_000;
  if (people >= 1_000_000) return `${(people / 1_000_000).toFixed(1).replace(/\.0$/, "")}M people`;
  if (people >= 1_000) return `${(people / 1_000).toFixed(0)}K people`;
  return `${people.toLocaleString("en-US")} people`;
}
