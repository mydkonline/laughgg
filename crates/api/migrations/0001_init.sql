CREATE TABLE IF NOT EXISTS creators (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    handle       VARCHAR(64)  NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assets (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    creator_id BIGINT UNSIGNED NOT NULL,
    title      VARCHAR(200) NOT NULL,
    category   VARCHAR(32)  NOT NULL,
    engine     VARCHAR(32)  NOT NULL,
    price_usd  DECIMAL(10,2) NOT NULL,
    art_style  VARCHAR(32)  NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assets_creator FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE,
    CONSTRAINT chk_assets_price CHECK (price_usd >= 0),
    INDEX idx_assets_creator (creator_id),
    INDEX idx_assets_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    asset_id        BIGINT UNSIGNED NOT NULL,
    mesh_integrity  TINYINT UNSIGNED NOT NULL,
    texture_quality TINYINT UNSIGNED NOT NULL,
    lod_setup       TINYINT UNSIGNED NOT NULL,
    runtime_cost    TINYINT UNSIGNED NOT NULL,
    license_clean   TINYINT UNSIGNED NOT NULL,
    code_quality    TINYINT UNSIGNED NOT NULL,
    integration     TINYINT UNSIGNED NOT NULL,
    total           TINYINT UNSIGNED NOT NULL,
    grade           VARCHAR(16) NOT NULL,
    reviewed_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT chk_reviews_range CHECK (
        mesh_integrity <= 100 AND texture_quality <= 100 AND lod_setup <= 100 AND
        runtime_cost <= 100 AND license_clean <= 100 AND code_quality <= 100 AND integration <= 100
    ),
    INDEX idx_reviews_asset (asset_id),
    INDEX idx_reviews_grade (grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS studios (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    plan        VARCHAR(32)  NOT NULL,
    monthly_krw INT UNSIGNED NOT NULL,
    started_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
    id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    asset_id  BIGINT UNSIGNED NOT NULL,
    studio_id BIGINT UNSIGNED NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    fee_rate  DECIMAL(4,3)  NOT NULL DEFAULT 0.080,
    sold_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_asset  FOREIGN KEY (asset_id)  REFERENCES assets(id)  ON DELETE CASCADE,
    CONSTRAINT fk_sales_studio FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    INDEX idx_sales_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS games (
    id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug      VARCHAR(64)  NOT NULL UNIQUE,
    name      VARCHAR(128) NOT NULL,
    developer VARCHAR(128) NOT NULL,
    engine    VARCHAR(64)  NOT NULL,
    confirmed TINYINT(1)   NOT NULL DEFAULT 0,
    dimension VARCHAR(8)   NOT NULL,
    platform  VARCHAR(16)  NOT NULL,
    scale     VARCHAR(16)  NOT NULL,
    year      SMALLINT UNSIGNED NOT NULL,
    INDEX idx_games_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
