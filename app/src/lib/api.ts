/* API 클라이언트.

   세션은 서버가 들고 쿠키로만 오간다. 그래서 모든 요청에 credentials 를
   붙인다 — 안 붙이면 브라우저가 쿠키를 안 실어 보내고, 로그인은 됐는데
   다음 요청부터 401 이 나는 상태가 된다.

   API 주소는 빌드 시점에 정해진다. 정적 배포(GitHub Pages)와 API 서버는
   도메인이 달라서, 다르면 서버 쪽 CORS 가 credentials 를 허용해야 한다.
   비워 두면 같은 도메인으로 본다. */

import type { CheckKey } from "../data/checks";
import { BASE, locale } from "./locale";

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/* 어느 말로 볼지 서버에 알린다.

   창작자가 쓴 제목과 설명은 사용자 데이터라 앱의 번역표에 못 들어간다.
   서버가 asset_translations 를 얹어서 준다 — 없으면 원문이 온다.

   기본 언어면 아예 안 붙인다. 붙여 봐야 조인만 한 번 더 돈다. */
function localeParam(): string {
  return locale() === BASE ? "" : `&locale=${locale()}`;
}

/** 서버가 준 오류. 상태 코드로 갈라 보려면 종류가 남아 있어야 한다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 로그인이 필요하거나 자격이 틀렸다. */
  get isAuth() {
    return this.status === 401;
  }

  /** 이미 있는 이메일처럼, 요청은 멀쩡하고 상태가 안 맞는 경우다. */
  get isConflict() {
    return this.status === 409;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/api${path}`, {
      ...init,
      // 쿠키를 싣는다. 이게 없으면 세션이 매 요청 사라진다.
      credentials: "include",
      headers: {
        /* 문자열 몸통일 때만 JSON 이다. 파일을 그대로 보내는 요청이 있어서,
           몸통이 있으면 무조건 붙이면 GLB 에 application/json 이 달린다. */
        ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // 서버가 안 떠 있거나 CORS 가 막은 경우다. 둘 다 브라우저는 같은 실패를
    // 주므로 여기서 구분할 수 없다.
    throw new ApiError(0, "서버에 닿지 못했습니다");
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `요청이 실패했습니다 (${res.status})`);
  }
  return body as T;
}

export type Account = {
  id: number;
  email: string;
  display_name: string;
  /** 비밀번호를 걸어 둔 계정인가. 구글로만 들어온 계정은 false 다. */
  has_password: boolean;
};

export const api = {
  signUp: (email: string, password: string, displayName?: string) =>
    call<Account>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName || undefined }),
    }),

  logIn: (email: string, password: string) =>
    call<Account>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logOut: () => call<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  /** 로그인 안 했으면 401 이 난다. 없는 게 정상인 호출이라 부르는 쪽이 삼킨다. */
  me: () => call<Account>("/auth/me"),

  /** 구글 로그인은 리다이렉트라 fetch 가 아니다. 주소만 만들어 준다. */
  googleUrl: () => `${API}/api/auth/google`,

  /* 올릴 자리를 받는다. 키는 서버가 정한다 — 우리가 정하면 uploads/ 밖이나
     남의 접두사를 적어 보낼 수 있다. */
  uploadIntent: (filename: string, bytes: number, sha256: string) =>
    call<UploadTarget>("/uploads", {
      method: "POST",
      body: JSON.stringify({ filename, bytes, sha256 }),
    }),

  /* 등록은 배지를 안 준다. 파일을 뜯어야 채점이 되기 때문이다.
     여기서 배지를 받던 시절에는 화면이 점수를 보내고 그대로 돌려받았다. */
  createAsset: (input: NewAsset) =>
    call<CreatedAsset>("/assets", { method: "POST", body: JSON.stringify(input) }),

  /* 파일을 서버에 보내 채점받는다.

     점수를 안 보낸다 — 보낼 자리가 없다. 몸통이 파일 그 자체라 JSON 이
     아니고, 그래서 content-type 도 안 붙인다. */
  analyzeAsset: (id: number, file: File) =>
    call<AnalysisResult>(`/assets/${id}/analyze`, { method: "POST", body: file }),

  /** 내 소유 목록. 같은 걸 두 번 사도 한 줄이다. */
  library: () => call<{ count: number; assets: OwnedAsset[] }>("/me/library"),

  /* 담긴 것들을 한 번에 가져온다. 상세를 열 번 부르면 화면이 열 번
     나눠 그려지고, 그중 하나가 느리면 그 줄만 늦게 뜬다. */
  assetsByIds: (ids: number[]) =>
    call<{ total: number; assets: MarketAsset[] }>(
      `/assets?ids=${ids.join(",")}&limit=${Math.max(ids.length, 1)}${localeParam()}`,
    ),

  /* 결제를 누르기 전에 무엇이 막혔는지 본다. 장바구니는 브라우저에 있어서
     며칠 전 상태가 그대로 남아 있다 — 그새 내려갔거나 이미 샀을 수 있다. */
  reviewCart: (ids: number[]) =>
    call<{ blocked: Blocked[] }>("/cart/review", {
      method: "POST",
      body: JSON.stringify({ asset_ids: ids }),
    }),

  /** 담긴 것을 통째로 결제한다. 하나라도 막히면 주문이 안 열린다. */
  checkoutCart: (ids: number[]) =>
    call<CheckoutSession>("/cart/checkout", {
      method: "POST",
      body: JSON.stringify({ asset_ids: ids }),
    }),

  /** 내 생성 작업과 잔액. */
  generations: () => call<{ credits: number; jobs: GenJob[] }>("/generate"),

  /* 만들어 달라고 넣는다. 202 로 돌아온다 — 생성이 30초에서 5분 걸려서
     응답을 기다릴 수 없다. 상태는 폴링으로 본다. */
  generate: (prompt: string, artStyle: string, quality: string) =>
    call<GenJob>("/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, art_style: artStyle, quality }),
    }),

  generation: (id: number) => call<GenJob>(`/generate/${id}`),
};

/** 마켓 목록 한 줄. 장바구니도 이 값으로 그린다. */
export type MarketAsset = {
  id: number;
  title: string;
  creator: string;
  category: string;
  engine: string;
  art_style: string;
  price_usd: number;
  total: number | null;
  badge: string | null;
};

/** 담겼는데 못 사는 줄. 이유는 서버가 준 말을 그대로 띄운다. */
export type Blocked = {
  asset_id: number;
  reason: string;
};

export type CheckoutSession = {
  order_id: number;
  amount_cents: number;
  checkout_url: string;
};

export type OwnedAsset = {
  asset_id: number;
  title: string;
  creator: string;
  category: string;
  engine: string;
  art_style: string;
  badge: string | null;
  paid_usd: number;
  paid_at: string;
};

export type GenJob = {
  id: number;
  status: "queued" | "running" | "done" | "failed";
  prompt: string;
  art_style: string;
  provider: string;
  credits: number;
  attempts: number;
  asset_id: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

export type UploadTarget = {
  file_key: string;
  upload_url: string;
  public_url: string;
};

/* 등록에 점수가 없다.

   한때 여기에 `scores` 가 있었다. 올리는 사람이 일곱 항목을 직접 정해서
   보냈고, 다들 100 을 놓고 챌린저를 받았다 — 배지가 아무 의미가 없었다.
   지금 화면이 보내는 건 파일과 **출처 신고** 뿐이고, 점수는 서버가 파일을
   뜯어 매긴다. */
export type NewAsset = {
  title: string;
  category: string;
  engine: string;
  art_style: string;
  price_usd: number;
  /** self_made | public_domain | licensed | ai_generated | unknown */
  origin: string;
  /** 캐릭터 전용. 포함 애니메이션 목록 — 이 유형의 make-or-break 다.
      원하는 모션이 없으면 아무리 잘 만들어도 안 팔린다. */
  animations?: string[];
  /** 툴/키트 전용. 지원이 make-or-break라 튜토리얼 영상과 문서 링크를 받는다.
      둘 다 없으면 스샷만 있는 툴로, 초보에겐 장롱이 된다. */
  tutorial_url?: string;
  docs_url?: string;
  file_key?: string;
  file_bytes?: number;
  file_sha256?: string;
};

/** 등록 직후. 배지는 아직 없다 — 파일을 안 뜯었기 때문이다. */
export type CreatedAsset = {
  asset_id: number;
  status: "pending_analysis";
};

/** 채점 결과. 이 값들은 전부 서버가 파일에서 만든 것이다. */
export type AnalysisResult = {
  asset_id: number;
  total: number;
  badge: string;
  production_ready: boolean;
  license_blocked: boolean;
  /** 코드 품질은 메시 에셋에 해당이 없어 null 이다. 0 이 아니다. */
  scores: Record<CheckKey, number | null>;
  /** 왜 그 점수인지. 점수만 주면 무엇을 고쳐야 할지 모른다. */
  notes: string[];
};
