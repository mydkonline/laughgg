-- LaughGG 초기 스키마.
--
-- 창작자가 에셋을 올리면 7개 항목을 채점해 배지를 매기고, 게임 스튜디오가
-- 구독으로 카탈로그에 접근한다. 수수료는 8% 단일이며 주 수익원은 구독이다.
--
-- 배지 이름은 처음부터 badge 다. MySQL 시절 grade 로 시작해 뒤늦게 바꿨는데,
-- 저장소를 Postgres 로 옮기면서 모든 DB 가 새로 시작하므로 여기서 정리한다.

CREATE TABLE IF NOT EXISTS creators (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    handle       VARCHAR(64)  NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creator_id BIGINT        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    title      VARCHAR(200)  NOT NULL,
    category   VARCHAR(32)   NOT NULL,
    engine     VARCHAR(32)   NOT NULL,
    price_usd  NUMERIC(10,2) NOT NULL CHECK (price_usd >= 0),
    art_style  VARCHAR(32)   NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_creator  ON assets (creator_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets (category);

-- 점수는 0..=100 이라 SMALLINT 로 충분하다. Postgres 에는 부호 없는 정수가 없어서
-- 하한도 같이 건다 — MySQL 의 UNSIGNED 가 해 주던 일이다.
CREATE TABLE IF NOT EXISTS reviews (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id        BIGINT      NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    mesh_integrity  SMALLINT    NOT NULL,
    texture_quality SMALLINT    NOT NULL,
    lod_setup       SMALLINT    NOT NULL,
    runtime_cost    SMALLINT    NOT NULL,
    license_clean   SMALLINT    NOT NULL,
    code_quality    SMALLINT    NOT NULL,
    integration     SMALLINT    NOT NULL,
    total           SMALLINT    NOT NULL,
    badge           VARCHAR(16) NOT NULL,
    reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reviews_range CHECK (
        mesh_integrity  BETWEEN 0 AND 100 AND
        texture_quality BETWEEN 0 AND 100 AND
        lod_setup       BETWEEN 0 AND 100 AND
        runtime_cost    BETWEEN 0 AND 100 AND
        license_clean   BETWEEN 0 AND 100 AND
        code_quality    BETWEEN 0 AND 100 AND
        integration     BETWEEN 0 AND 100 AND
        total           BETWEEN 0 AND 100
    )
);

CREATE INDEX IF NOT EXISTS idx_reviews_asset ON reviews (asset_id);
CREATE INDEX IF NOT EXISTS idx_reviews_badge ON reviews (badge);

CREATE TABLE IF NOT EXISTS studios (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    plan        VARCHAR(32)  NOT NULL,
    monthly_krw INTEGER      NOT NULL CHECK (monthly_krw >= 0),
    started_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    active      BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sales (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id  BIGINT        NOT NULL REFERENCES assets(id)  ON DELETE CASCADE,
    studio_id BIGINT            NULL REFERENCES studios(id) ON DELETE SET NULL,
    price_usd NUMERIC(10,2) NOT NULL CHECK (price_usd >= 0),
    fee_rate  NUMERIC(4,3)  NOT NULL DEFAULT 0.080 CHECK (fee_rate BETWEEN 0 AND 1),
    sold_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_asset ON sales (asset_id);

CREATE TABLE IF NOT EXISTS games (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug      VARCHAR(64)  NOT NULL UNIQUE,
    name      VARCHAR(128) NOT NULL,
    developer VARCHAR(128) NOT NULL,
    engine    VARCHAR(64)  NOT NULL,
    confirmed BOOLEAN      NOT NULL DEFAULT FALSE,
    dimension VARCHAR(8)   NOT NULL,
    platform  VARCHAR(16)  NOT NULL,
    scale     VARCHAR(16)  NOT NULL,
    year      SMALLINT     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_platform ON games (platform);
