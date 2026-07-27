/* 에셋 콘텐츠의 다국어.

   화면 문구는 앱이 빌드 시점 표로 옮긴다. 그런데 창작자가 올린 제목과
   설명은 그 표에 못 들어간다 — 사용자 데이터라 빌드할 때 존재하지 않는다.
   마켓이 DB 로 넘어온 이상 여기가 유일한 자리다.

   **기본 언어는 assets 에 그대로 둔다.** 이 표는 덮어쓰는 값만 담는다.
   그래서

     - 지금 있는 27종은 손댈 필요가 없다
     - 번역이 없으면 COALESCE 가 원문으로 떨어진다
     - "영어 제목이 없는 에셋이 몇 개냐" 를 셀 수 있다

   제목만 있고 설명은 없는 상태를 허용한다. 둘 다 NULL 이면 줄이 있을
   이유가 없으므로 그건 막는다.

   locale 은 짧은 코드다(ko, en). 지역까지 나누는 날이 오면 en-GB 처럼
   길어지므로 넉넉히 잡되, 앱이 아는 값만 쓴다. */

CREATE TABLE IF NOT EXISTS asset_translations (
    asset_id    BIGINT      NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    locale      VARCHAR(12) NOT NULL,
    title       VARCHAR(200)    NULL,
    description TEXT            NULL,
    /* 누가 썼는지. 창작자가 직접 쓴 것과 나중에 기계로 채운 것을 섞으면
       어느 쪽을 믿을지 정할 수가 없다. */
    source      VARCHAR(16) NOT NULL DEFAULT 'creator'
                CHECK (source IN ('creator', 'machine', 'staff')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (asset_id, locale),
    CONSTRAINT chk_translation_not_empty
        CHECK (title IS NOT NULL OR description IS NOT NULL)
);

-- "영어가 없는 에셋" 을 세는 질의가 이 인덱스를 탄다.
CREATE INDEX IF NOT EXISTS idx_asset_translations_locale
    ON asset_translations (locale);
