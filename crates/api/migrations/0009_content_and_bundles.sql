-- 네비게이션 페이지가 쓰는 것들을 저장소로 옮긴다.
--
-- 프론트가 정적 TS 배열로 들고 있던 것들 중 "늘어나는 것" 만 여기로 온다.
-- 늘어나지 않는 것 — 변환 컨셉 11종, 팔레트 9종, 출력 형식 19종 — 은 제품
-- 설정이라 코드에 남긴다. DB 에 넣으면 배포 없이 바뀔 수 있게 되는데,
-- 그 값들은 렌더링 코드와 짝이라 따로 바뀌면 그림이 깨진다.

/* 커뮤니티 글.

   뉴스·사례·브이로그·기사를 한 테이블에 담고 kind 로 가른다. 넷은 모양이
   거의 같고 화면만 다르다 — 테이블을 넷으로 나누면 목록·검색·페이지네이션을
   네 번 쓰게 된다.

   사례는 지금 브라우저 localStorage 에만 있다. 기기를 바꾸면 사라지고
   남에게 안 보인다 — 커뮤니티인데 혼자만 보는 상태였다. */
CREATE TABLE IF NOT EXISTS posts (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind       VARCHAR(16)  NOT NULL
               CHECK (kind IN ('news', 'case', 'vlog', 'article')),
    slug       VARCHAR(96)  NOT NULL UNIQUE,
    title      VARCHAR(200) NOT NULL,
    -- 목록에 뜨는 한 줄. 본문 앞부분을 자르면 문장이 중간에 끊긴다.
    summary    VARCHAR(300)     NULL,
    body       TEXT         NOT NULL DEFAULT '',
    tag        VARCHAR(32)      NULL,
    -- 쓴 사람. 운영자가 넣은 뉴스는 비어 있다.
    author_id  BIGINT           NULL REFERENCES accounts(id) ON DELETE SET NULL,
    -- 사례는 어떤 에셋을 다뤘는지 붙는다.
    asset_id   BIGINT           NULL REFERENCES assets(id)   ON DELETE SET NULL,
    -- 기사·뉴스의 원문 출처. 인용인지 우리 글인지 구분된다.
    source     VARCHAR(128)     NULL,
    source_url VARCHAR(512)     NULL,
    /* 글마다 모양이 다른 부분. 사례는 상황·문제·해결과 파라미터가,
       뉴스는 인용 수치가, 브이로그는 영상 길이가 붙는다. 컬럼으로 펴면
       대부분 NULL 인 열이 열몇 개 생긴다. */
    detail     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_kind    ON posts (kind, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_detail  ON posts USING GIN (detail jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_posts_title   ON posts USING GIN (title gin_trgm_ops);

/* 패키지 상품.

   한 프로젝트에 필요한 걸 한 번에 파는 묶음이다. 낱개와 같은 칸에 두면
   가격 비교가 깨져서 상품 목록과 나눈다.

   가격을 저장하지 않는다. 낱개 합계에서 할인율을 빼서 그때그때 센다 —
   박아 두면 안에 든 에셋 가격이 바뀔 때 조용히 어긋난다. */
CREATE TABLE IF NOT EXISTS bundles (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug       VARCHAR(64)  NOT NULL UNIQUE,
    name       VARCHAR(128) NOT NULL,
    note       VARCHAR(200) NOT NULL,
    -- 0.35 면 35% 싸다.
    discount   NUMERIC(4,3) NOT NULL CHECK (discount > 0 AND discount < 1),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bundle_items (
    bundle_id BIGINT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    asset_id  BIGINT NOT NULL REFERENCES assets(id)  ON DELETE CASCADE,
    PRIMARY KEY (bundle_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_asset ON bundle_items (asset_id);

/* 게임 씬.

   에셋을 그 게임의 톤에 맞출 때 쓰는 값이다. 조명·안개·색보정처럼 게임마다
   다른 숫자 묶음이라 JSONB 로 둔다 — 광원 개수부터 게임마다 다르다.

   games 와 따로 둔다. 엔진 목록에 있는 게임과 씬이 있는 게임이 다르고,
   합치면 한쪽만 있는 행이 절반이 된다. */
CREATE TABLE IF NOT EXISTS scenes (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug      VARCHAR(64)  NOT NULL UNIQUE,
    name      VARCHAR(128) NOT NULL,
    -- 사실적 / 준사실적 / 스타일라이즈
    category  VARCHAR(32)  NOT NULL,
    -- 다크 판타지, 사이버펑크 같은 세부 분위기
    mood      VARCHAR(48)  NOT NULL,
    dimension VARCHAR(8)   NOT NULL,
    -- 장르에서 추정한 값인가. 확인된 것과 섞으면 자료가 아니다.
    guessed   BOOLEAN      NOT NULL DEFAULT FALSE,
    -- 조명, 안개, 색보정, 배치. 게임마다 모양이 다르다.
    look      JSONB        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenes_category ON scenes (category);
CREATE INDEX IF NOT EXISTS idx_scenes_mood     ON scenes (mood);
