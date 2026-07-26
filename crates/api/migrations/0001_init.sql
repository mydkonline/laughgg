-- 창작자
CREATE TABLE IF NOT EXISTS creators (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    handle      TEXT    NOT NULL UNIQUE,
    display_name TEXT   NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 에셋
CREATE TABLE IF NOT EXISTS assets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id  INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    category    TEXT    NOT NULL,          -- weapon | character | environment | ui | audio | tool
    engine      TEXT    NOT NULL,          -- unity | unreal | godot | any
    price_usd   REAL    NOT NULL CHECK (price_usd >= 0),
    art_style   TEXT    NOT NULL,          -- pixel | lowpoly | realistic | stylized
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_creator  ON assets(creator_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);

-- 검수 결과 (에셋당 최신 1건)
CREATE TABLE IF NOT EXISTS reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    mesh_integrity  INTEGER NOT NULL CHECK (mesh_integrity  BETWEEN 0 AND 100),
    texture_quality INTEGER NOT NULL CHECK (texture_quality BETWEEN 0 AND 100),
    lod_setup       INTEGER NOT NULL CHECK (lod_setup       BETWEEN 0 AND 100),
    runtime_cost    INTEGER NOT NULL CHECK (runtime_cost    BETWEEN 0 AND 100),
    license_clean   INTEGER NOT NULL CHECK (license_clean   BETWEEN 0 AND 100),
    code_quality    INTEGER NOT NULL CHECK (code_quality    BETWEEN 0 AND 100),
    integration     INTEGER NOT NULL CHECK (integration     BETWEEN 0 AND 100),
    total           INTEGER NOT NULL,
    grade           TEXT    NOT NULL,      -- challenger | diamond | platinum | silver
    reviewed_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_asset ON reviews(asset_id);

-- 스튜디오 구독 (주 수익원)
CREATE TABLE IF NOT EXISTS studios (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    plan         TEXT    NOT NULL,         -- trial | standard | enterprise
    monthly_krw  INTEGER NOT NULL CHECK (monthly_krw >= 0),
    started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    active       INTEGER NOT NULL DEFAULT 1
);

-- 판매
CREATE TABLE IF NOT EXISTS sales (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    studio_id   INTEGER REFERENCES studios(id) ON DELETE SET NULL,
    price_usd   REAL    NOT NULL,
    fee_rate    REAL    NOT NULL DEFAULT 0.08,   -- D안: 8% 단일
    sold_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_asset ON sales(asset_id);

-- 게임 스택 (참고 데이터)
CREATE TABLE IF NOT EXISTS games (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    developer  TEXT    NOT NULL,
    engine     TEXT    NOT NULL,
    confirmed  INTEGER NOT NULL DEFAULT 0,  -- 1=공개자료 확인, 0=추정
    dimension  TEXT    NOT NULL,            -- 2D | 3D
    platform   TEXT    NOT NULL,            -- steam | mobile | console | web
    scale      TEXT    NOT NULL,            -- aaa | team | solo
    year       INTEGER NOT NULL
);
