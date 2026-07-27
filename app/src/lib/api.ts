/* API 클라이언트.

   세션은 서버가 들고 쿠키로만 오간다. 그래서 모든 요청에 credentials 를
   붙인다 — 안 붙이면 브라우저가 쿠키를 안 실어 보내고, 로그인은 됐는데
   다음 요청부터 401 이 나는 상태가 된다.

   API 주소는 빌드 시점에 정해진다. 정적 배포(GitHub Pages)와 API 서버는
   도메인이 달라서, 다르면 서버 쪽 CORS 가 credentials 를 허용해야 한다.
   비워 두면 같은 도메인으로 본다. */

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      // 쿠키를 싣는다. 이게 없으면 세션이 매 요청 사라진다.
      credentials: "include",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
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
  googleUrl: () => `${BASE}/api/auth/google`,

  /* 올릴 자리를 받는다. 키는 서버가 정한다 — 우리가 정하면 uploads/ 밖이나
     남의 접두사를 적어 보낼 수 있다. */
  uploadIntent: (filename: string, bytes: number, sha256: string) =>
    call<UploadTarget>("/uploads", {
      method: "POST",
      body: JSON.stringify({ filename, bytes, sha256 }),
    }),

  createAsset: (input: NewAsset) =>
    call<ReviewResult>("/assets", { method: "POST", body: JSON.stringify(input) }),
};

export type UploadTarget = {
  file_key: string;
  upload_url: string;
  public_url: string;
};

export type Scores = {
  mesh_integrity: number;
  texture_quality: number;
  lod_setup: number;
  runtime_cost: number;
  license_clean: number;
  code_quality: number;
  integration: number;
};

export type NewAsset = {
  title: string;
  category: string;
  engine: string;
  art_style: string;
  price_usd: number;
  scores: Scores;
  file_key?: string;
  file_bytes?: number;
  file_sha256?: string;
};

export type ReviewResult = {
  asset_id: number;
  total: number;
  badge: string;
  production_ready: boolean;
  license_blocked: boolean;
};
