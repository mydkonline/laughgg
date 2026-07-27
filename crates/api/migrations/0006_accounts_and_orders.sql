-- 계정, 세션, 주문.
--
-- 계정과 로그인 수단을 나눈다. 한 사람이 비밀번호로도 구글로도 들어올 수
-- 있어야 하고, 나중에 수단이 하나 늘 때 계정 테이블을 안 건드려야 한다.
-- 이메일이 같으면 같은 사람으로 본다 — 구글로 처음 들어온 뒤 비밀번호를
-- 걸어도 계정이 둘로 갈리지 않는다.

CREATE TABLE IF NOT EXISTS accounts (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    display_name  VARCHAR(128) NOT NULL,
    -- 구글로만 들어온 계정은 비밀번호가 없다. 없는 것과 빈 문자열은 다르다.
    password_hash TEXT             NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 대소문자를 구분하면 Sh@op.gg 와 sh@op.gg 가 다른 사람이 된다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts (lower(email));

-- 소셜 로그인 수단. provider 마다 사용자 식별자 체계가 달라 문자열로 둔다.
CREATE TABLE IF NOT EXISTS identities (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id  BIGINT       NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider    VARCHAR(32)  NOT NULL,
    subject     VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (provider, subject)
);

CREATE INDEX IF NOT EXISTS idx_identities_account ON identities (account_id);

/* 세션.

   토큰 원문을 저장하지 않는다. DB 가 새면 그 자리에서 전원 로그인이 되기
   때문이다. 해시만 두고 원문은 쿠키로만 오간다 — 비밀번호와 같은 취급이다.
   해시는 SHA-256 이면 충분하다. 토큰이 32바이트 난수라 사전 공격 대상이
   아니고, Argon2 를 쓰면 요청마다 수십 밀리초를 태우게 된다. */
CREATE TABLE IF NOT EXISTS sessions (
    token_hash  CHAR(64)    PRIMARY KEY,
    account_id  BIGINT      NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON sessions (expires_at);

/* 주문.

   결제는 Stripe 가 한다. 카드 번호는 우리 서버를 지나가지 않는다 — 결제창은
   Stripe 가 띄우고 우리는 승인 통보만 받는다.

   금액을 주문 시점에 박아 둔다. 에셋 가격이 나중에 바뀌어도 지난 주문이
   따라 움직이면 안 된다. 통화 단위는 센트다 — 실수로 다루면 반올림이 쌓인다. */
CREATE TABLE IF NOT EXISTS orders (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id   BIGINT      NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id     BIGINT      NOT NULL REFERENCES assets(id)   ON DELETE RESTRICT,
    amount_cents INTEGER     NOT NULL CHECK (amount_cents > 0),
    currency     CHAR(3)     NOT NULL DEFAULT 'usd',
    status       VARCHAR(16) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid', 'canceled', 'refunded')),
    -- Stripe Checkout Session id. 같은 통보가 두 번 와도 한 번만 처리하려고 쓴다.
    provider_ref VARCHAR(255)    NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at      TIMESTAMPTZ     NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_ref
    ON orders (provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_account ON orders (account_id, created_at DESC);

-- 판매가 어느 주문에서 나왔는지 남긴다. 없으면 시드로 넣은 판매다.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id BIGINT NULL
    REFERENCES orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_order
    ON sales (order_id) WHERE order_id IS NOT NULL;
