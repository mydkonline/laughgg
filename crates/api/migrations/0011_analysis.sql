-- 분석은 서버가 한다.
--
-- 올리는 사람이 점수를 정하면 다들 100 을 놓고 챌린저를 받는다. 그 순간
-- 배지가 아무 의미가 없어지고 "검증된 마켓" 이라는 말이 무너진다.
--
-- 일곱 항목이 전부 파일에서 나오지는 않는다. 못 재는 둘을 지어내지 않는다.
--   코드 품질    메시 에셋에는 스크립트가 없다 → NULL
--   라이선스 출처  파일로는 알 수 없다 → 올리는 사람이 신고하고 우리가 감사한다

ALTER TABLE reviews
    -- 코드 품질은 해당 없음일 수 있다. 0 으로 두면 없는 항목으로 깎인다.
    ALTER COLUMN code_quality DROP NOT NULL,
    -- 파일에서 잰 값. 왜 그 점수가 나왔는지 되짚을 수 있어야 한다.
    ADD COLUMN IF NOT EXISTS facts JSONB NULL,
    -- 사람이 읽는 지적. 점수만 주면 무엇을 고쳐야 할지 모른다.
    ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 코드 품질이 NULL 이어도 체크가 통과해야 한다.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS chk_reviews_range;
ALTER TABLE reviews ADD CONSTRAINT chk_reviews_range CHECK (
    mesh_integrity  BETWEEN 0 AND 100 AND
    texture_quality BETWEEN 0 AND 100 AND
    lod_setup       BETWEEN 0 AND 100 AND
    runtime_cost    BETWEEN 0 AND 100 AND
    license_clean   BETWEEN 0 AND 100 AND
    integration     BETWEEN 0 AND 100 AND
    total           BETWEEN 0 AND 100 AND
    (code_quality IS NULL OR code_quality BETWEEN 0 AND 100)
);

/* 출처 신고.

   점수를 고르는 것과 출처를 밝히는 건 다른 일이다. 신고는 기록으로 남고
   나중에 감사할 수 있다 — 점수는 그럴 수가 없다.

   Unity 도 2026 기준 AI 생성 여부 신고를 요구한다. 같은 이유다. */
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS origin VARCHAR(16) NOT NULL DEFAULT 'unknown'
        CHECK (origin IN ('self_made', 'public_domain', 'licensed', 'ai_generated', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_assets_origin ON assets (origin);
