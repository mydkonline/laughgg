import { useCallback, useSyncExternalStore } from "react";
import type { Knobs, RasterSet } from "../data/concepts";
import { t } from "./locale";

/* 커뮤니티를 게시판으로 만들지 않는다. 빈 글쓰기 칸이 커뮤니티를 죽인다.
   스튜디오에서 작업을 끝내면 그게 곧 게시물이 된다 — 아무도 "글을 쓰지" 않는데
   결과물이 쌓이고, 댓글은 그 결과물에 달린다.

   기여는 사람이 아니라 물건에 붙는다. 사람한테 점수를 주면 서열이 생기므로
   드러나는 숫자는 "이 프리셋을 몇 명이 가져다 썼는가" 하나뿐이다. */

export type Author = {
  /** 표시 이름. 익명이 기본이다. */
  name: string;
  /** 소속만 인증하고 신원은 가린다 — 실명으로는 실무 얘기가 안 나온다. */
  studio?: string;
  verified?: boolean;
};

export type Comment = {
  id: string;
  by: Author;
  body: string;
  at: number;
};

export type Post = {
  id: string;
  /** 어떤 상품을 어떤 프리셋으로 바꿨는가 */
  pieceId: number;
  title: string;
  /** 무엇을 하려던 상황인가 */
  situation: string;
  /** 어디서 막혔나 */
  problem: string;
  /** 어떻게 풀었나. 순서대로 */
  steps: string[];
  concept: string;
  prompt: string;
  knobs: Knobs;
  /** 2D 로 뽑은 프리셋이면 팔레트·도트 설정이 같이 붙는다. 없으면 3D 프리셋이다. */
  raster?: RasterSet;
  /** 검수 점수가 어떻게 움직였는지. 자랑도 실패도 그대로 남긴다. */
  before: number;
  after: number;
  by: Author;
  at: number;
  /** 이 프리셋을 가져다 쓴 횟수. 유일한 공개 지표다. */
  forks: number;
  comments: Comment[];
  /** 운영자가 심은 씨앗. 빈 피드를 열지 않기 위한 것이고 숨기지 않는다. */
  seeded?: boolean;
};

/* 형식이 바뀌면 키를 올린다. 옛 데이터가 새 화면을 깨뜨리는 게 제일 흔한 사고다. */
const KEY = "igg-feed-v2";

/** 씨앗 글은 상대 시각으로 심는다 — 고정 날짜를 박으면 몇 달 뒤에 유물처럼 보인다. */
const daysAgo = (d: number) => Date.now() - d * 86_400_000;
const subs = new Set<() => void>();

/* 씨앗은 운영자가 쓴다. 초기 피드가 비어 있으면 아무도 두 번째로 오지 않는다.
   실패 사례를 같이 넣는다 — 떨어진 이유가 붙은 글이 제일 잘 읽힌다. */
const SEED: Post[] = [
  {
    id: "s1",
    pieceId: 1,
    title: "도트 게임에 3D 에셋을 섞어 쓰기",
    situation: "2D 도트로 만든 던전에 3D 모델 에셋을 넣어야 했습니다.",
    problem: "3D 모델을 그대로 놓으면 해상도와 음영이 달라 도트 타일 옆에서 혼자 튑니다.",
    steps: [
      "형식을 2D 스프라이트로 바꾼다",
      "팔레트를 이끼 6색으로 고정한다",
      "도트 굵기를 2로 두고 디더링을 34까지 올린다",
      "면 처리를 낮춰 실루엣이 뭉개지지 않게 한다",
    ],
    concept: "다크 판타지",
    prompt: "어둡고 축축한 지하 성당, 금속만 반사, 채도 낮게",
    knobs: { tone: 78, warm: 28, gloss: 64, facet: 8, sat: 34, line: 10 },
    before: 94,
    after: 92,
    by: { name: "익명", studio: "국내 모바일 게임사", verified: true },
    at: daysAgo(3),
    forks: 137,
    seeded: true,
    comments: [
      {
        id: "s1c1",
        by: { name: "익명" },
        body: "광택을 64까지 올리면 모바일에서 드로우콜이 아깝습니다. 48 정도로 낮춰도 그림은 거의 같아요.",
        at: daysAgo(2),
      },
      {
        id: "s1c2",
        by: { name: "익명", studio: "PC 인디 2인팀", verified: true },
        body: "그대로 포크해서 우리 던전에 넣어 봤는데 외곽선 10은 너무 얇아서 안 보였습니다. 20부터 티가 납니다.",
        at: daysAgo(1),
      },
    ],
  },
  {
    id: "s2",
    pieceId: 6,
    title: "광택을 올렸다가 점수가 18점 떨어진 경우",
    situation: "금속 질감을 강조하려고 광택을 끝까지 올렸습니다.",
    problem: "그림은 화려해졌는데 런타임 점수가 크게 떨어져 배지가 표준으로 내려갔습니다.",
    steps: [
      "광택 98은 셰이더 비용을 그대로 올린다",
      "48까지 낮춰도 눈에 보이는 차이는 거의 없다",
      "대신 채도를 올려 화려함을 보완한다",
    ],
    concept: "직접 조정",
    prompt: "전부 금속처럼, 최대한 번쩍이게",
    knobs: { tone: 40, warm: 60, gloss: 98, facet: 0, sat: 92, line: 0 },
    before: 86,
    after: 68,
    by: { name: "운영자" },
    at: daysAgo(9),
    forks: 41,
    seeded: true,
    comments: [
      {
        id: "s2c1",
        by: { name: "익명" },
        body: "런타임 항목이 이렇게 크게 떨어지는 게 맞나요? 셰이더 비용만으로 18점은 과한 것 같은데요.",
        at: daysAgo(8),
      },
    ],
  },
  {
    id: "s3",
    pieceId: 2,
    title: "게임보이 4색 안에서 실루엣 살리기",
    situation: "게임보이 팔레트로 맞춘 프로젝트에 무기 에셋이 필요했습니다.",
    problem: "색이 네 개뿐이라 형태가 뭉개져 무엇인지 안 읽힙니다.",
    steps: [
      "팔레트를 게임보이로 고정한다",
      "디더링을 70까지 올려 중간색을 만든다",
      "외곽선을 22로 세워 형태를 잡는다",
      "도트 굵기는 6 이상으로 둔다",
    ],
    concept: "픽셀 레트로",
    prompt: "로우폴리, 색 끊기, 픽셀 아트 옆에 세울 것",
    knobs: { tone: 44, warm: 56, gloss: 18, facet: 96, sat: 86, line: 0 },
    raster: { pixel: 5, palette: "pico8", dither: 52 },
    before: 92,
    after: 95,
    by: { name: "익명" },
    at: daysAgo(16),
    forks: 88,
    seeded: true,
    comments: [],
  },
];

function load(): Post[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return SEED;
    /* 키를 올려도 다른 탭에서 옛 형식이 넘어올 수 있다. 모양을 확인하고 받는다. */
    return (v as Post[]).filter((p) => Array.isArray(p?.steps) && typeof p?.situation === "string");
  } catch {
    return SEED;
  }
}

let posts: Post[] = load();

function commit(next: Post[]) {
  posts = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(posts));
  } catch {
    /* 저장이 막혀도 이번 세션은 굴러간다 */
  }
  subs.forEach((cb) => cb());
}

const EMPTY: Post[] = [];

export function useFeed() {
  const list = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => posts,
    () => EMPTY,
  );

  const publish = useCallback((p: Omit<Post, "id" | "at" | "forks" | "comments">) => {
    const post: Post = { ...p, id: `p${Date.now()}`, at: Date.now(), forks: 0, comments: [] };
    commit([post, ...posts]);
    return post.id;
  }, []);

  const fork = useCallback((id: string) => {
    commit(posts.map((p) => (p.id === id ? { ...p, forks: p.forks + 1 } : p)));
  }, []);

  const comment = useCallback((id: string, body: string, by: Author) => {
    commit(
      posts.map((p) =>
        p.id === id
          ? { ...p, comments: [...p.comments, { id: `c${Date.now()}`, by, body, at: Date.now() }] }
          : p,
      ),
    );
  }, []);

  return { list, publish, fork, comment };
}

/** 상대 시각. 초 단위까지 보여줄 이유가 없다. */
export function ago(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return t("방금");
  if (s < 3600) return t("{n}분 전", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n}시간 전", { n: Math.floor(s / 3600) });
  return t("{n}일 전", { n: Math.floor(s / 86400) });
}
