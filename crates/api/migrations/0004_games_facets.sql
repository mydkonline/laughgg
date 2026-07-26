-- 패싯 검색을 DB 로 옮긴다.
--
-- 프론트가 게임 212개를 통째로 받아 브라우저에서 걸러 왔다. 수천 개가 되면
-- 그게 안 된다 — 첫 화면에 전부 실어 보내야 하고, 축마다 개수를 세는 일도
-- 클라이언트 몫이 된다. 필터와 집계를 여기로 내린다.
--
-- 축은 넷이다. 엔진 계열, 분류, 규모, 출시 연도.

-- platform 을 category 로 바꾼다. 값이 steam/mobile/indie 라 유통 경로가
-- 아니라 분류에 가깝고, 프론트도 그렇게 부르고 있다.
ALTER TABLE games RENAME COLUMN platform TO category;
ALTER INDEX idx_games_platform RENAME TO idx_games_category;

-- dimension 은 게임 목록에서 안 쓴다. 씬 데이터 쪽 축이라 여기서는 뺀다.
ALTER TABLE games DROP COLUMN dimension;

ALTER TABLE games
    ADD COLUMN IF NOT EXISTS rank     INTEGER     NULL,
    ADD COLUMN IF NOT EXISTS owners   VARCHAR(32) NULL,
    ADD COLUMN IF NOT EXISTS positive INTEGER     NULL CHECK (positive IS NULL OR positive >= 0),
    -- 게임마다 스택 항목 수가 다르다. 컬럼으로 펴면 대부분 NULL 인 열이 생기고,
    -- 항목이 하나 늘 때마다 마이그레이션을 써야 한다.
    ADD COLUMN IF NOT EXISTS stack    JSONB       NOT NULL DEFAULT '[]'::jsonb;

-- 엔진 계열. "Unreal Engine 5" 와 "Unreal Engine 4" 는 같은 계열이라
-- 점유를 셀 때 하나로 묶여야 한다. 매번 문자열을 자르지 않도록 저장해 둔다.
ALTER TABLE games
    ADD COLUMN IF NOT EXISTS engine_family VARCHAR(48)
    GENERATED ALWAYS AS (split_part(engine, ' ', 1)) STORED;

CREATE INDEX IF NOT EXISTS idx_games_engine_family ON games (engine_family);
CREATE INDEX IF NOT EXISTS idx_games_scale         ON games (scale);
CREATE INDEX IF NOT EXISTS idx_games_year          ON games (year);

-- 스택 안을 조건으로 걸 수 있게 한다. "Steam Workshop 을 쓰는 게임" 같은
-- 질의가 stack @> '[{"name":"Steam Workshop"}]' 로 인덱스를 탄다.
CREATE INDEX IF NOT EXISTS idx_games_stack ON games USING GIN (stack jsonb_path_ops);

-- 이름 검색. LIKE '%...%' 는 B-tree 를 못 타서 trigram 을 쓴다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_games_name_trgm ON games USING GIN (name gin_trgm_ops);
