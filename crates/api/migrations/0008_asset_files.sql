-- 에셋 파일과 다운로드 기록.
--
-- 지금까지 assets 에는 파일을 가리키는 칸이 없었다. 제목과 가격만 있고
-- 정작 파는 물건이 없는 상태다.
--
-- 파일 자체는 여기 안 넣는다. DB 에 바이너리를 담으면 백업과 복제가 통째로
-- 무거워지고, 스트리밍도 안 된다. 오브젝트 스토리지의 키만 둔다.

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS file_key   VARCHAR(512) NULL,
    ADD COLUMN IF NOT EXISTS file_bytes BIGINT       NULL
        CHECK (file_bytes IS NULL OR file_bytes > 0),
    -- 받는 쪽이 무결성을 확인할 수 있어야 한다. 중간에 깨진 파일을
    -- 엔진에 넣으면 원인을 엉뚱한 데서 찾게 된다.
    ADD COLUMN IF NOT EXISTS file_sha256 CHAR(64)    NULL;

/* 다운로드 허가.

   허가를 발급하고 그 토큰으로만 받게 한다. 에셋 id 를 그대로 URL 에 넣으면
   그 주소가 어디로든 퍼진다 — 산 사람이 링크를 넘기면 그걸로 끝이다.

   토큰은 짧게 산다. 오래 살면 허가가 아니라 공개 링크가 된다.
   세션과 같은 이유로 해시만 저장한다. */
CREATE TABLE IF NOT EXISTS download_grants (
    token_hash CHAR(64)    PRIMARY KEY,
    account_id BIGINT      NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id   BIGINT      NOT NULL REFERENCES assets(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    -- 몇 번 썼는지. 한 허가가 수천 번 쓰이면 링크가 샌 것이다.
    used_count INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_grants_expiry  ON download_grants (expires_at);
CREATE INDEX IF NOT EXISTS idx_grants_account ON download_grants (account_id, asset_id);
