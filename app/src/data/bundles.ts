import { PIECES, type Piece } from "./pieces";

/* 패키지 상품.

   Unity Asset Store 가 번들을 따로 파는 이유는 두 가지다. 사는 쪽은 한 프로젝트에
   필요한 걸 한 번에 받고, 파는 쪽은 개별 판매보다 객단가가 오른다.

   구조상 중요한 건 셋이다.
     1. 패키지는 상품 목록에 섞이지 않는다. 단품과 같은 칸에 두면 가격 비교가 깨진다.
     2. 안에 무엇이 들었는지 낱개로 다 보인다. 안 보이면 못 산다.
     3. 낱개 합계와 패키지 가격을 나란히 낸다. 얼마를 아끼는지가 사는 이유다.

   묶음 기준은 "한 프로젝트에서 같이 쓰이는가" 다. 분류가 같다고 묶지 않는다 —
   조명 열 개는 아무도 한꺼번에 안 산다. */

export type Bundle = {
  id: string;
  name: string;
  /** 어떤 프로젝트에 쓰는 묶음인가. 한 줄. */
  note: string;
  /** 묶인 상품 id */
  items: number[];
  /** 낱개 합계 대비 할인율 */
  off: number;
};

export const BUNDLES: Bundle[] = [
  {
    id: "b-crypt",
    name: "고딕 지하실 세트",
    note: "던전 한 층을 채우는 구조물과 소품",
    items: [1, 3, 6, 9, 13],
    off: 0.35,
  },
  {
    id: "b-tavern",
    name: "선술집 세트",
    note: "실내 씬 하나를 통째로 세우는 가구와 식기",
    items: [4, 8, 14, 15, 17, 20],
    off: 0.4,
  },
  {
    id: "b-iso",
    name: "아이소메트릭 타일 세트",
    note: "도트 프로젝트의 지형과 건물",
    items: [21, 22, 23],
    off: 0.25,
  },
  {
    id: "b-forge",
    name: "무기 공방 세트",
    note: "무기와 방어구, 대장간 소품",
    items: [2, 5, 12],
    off: 0.3,
  },
];

export type BundlePrice = {
  /** 낱개로 다 사면 */
  single: number;
  /** 묶어 사면 */
  bundled: number;
  /** 아끼는 금액 */
  saved: number;
};

export function bundleItems(b: Bundle): Piece[] {
  return b.items.map((id) => PIECES.find((p) => p.id === id)).filter((p): p is Piece => Boolean(p));
}

/** 낱개 합계에서 할인율을 뺀다. 표시 가격을 따로 적어 두면 상품이 바뀔 때 어긋난다. */
export function bundlePrice(b: Bundle): BundlePrice {
  const single = bundleItems(b).reduce((a, p) => a + p.price, 0);
  const bundled = Math.round(single * (1 - b.off));
  return { single, bundled, saved: single - bundled };
}

/** 묶음의 대표 점수. 제일 낮은 항목을 쓴다 — 묶음은 가장 약한 것만큼만 쓸 만하다. */
export function bundleScore(b: Bundle): number {
  const items = bundleItems(b);
  return items.length ? Math.min(...items.map((p) => p.score)) : 0;
}
