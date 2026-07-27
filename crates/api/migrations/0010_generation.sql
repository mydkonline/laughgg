-- AI 에셋 생성.
--
-- 생성은 30초에서 5분 걸린다. HTTP 요청 안에서 기다릴 수 없다 — 그동안 워커를
-- 붙잡고 있으면 동시 접속 몇십 명에 서버가 멈춘다. 작업을 큐에 넣고 돌아온다.
--
-- 큐를 Redis 로 안 뺀다. Postgres 의 SELECT ... FOR UPDATE SKIP LOCKED 로
-- 충분하고, 무엇보다 크레딧 차감과 작업 등록이 한 트랜잭션에 들어간다.
-- 나누면 "크레딧은 깎였는데 작업은 안 들어간" 상태가 생긴다.

/* 크레딧.

   생성은 돈이 든다. 무제한으로 열면 한 사람이 API 요금을 태울 수 있다.
   잔액을 컬럼 하나로 두지 않고 원장을 남긴다 — 숫자만 있으면 왜 줄었는지
   물었을 때 답할 수가 없고, 환불 처리가 곧 숫자 고치기가 된다. */
CREATE TABLE IF NOT EXISTS credit_ledger (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT      NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    -- 충전이면 양수, 사용이면 음수. 합이 곧 잔액이다.
    delta      INTEGER     NOT NULL CHECK (delta <> 0),
    reason     VARCHAR(32) NOT NULL
               CHECK (reason IN ('signup', 'purchase', 'generation', 'refund', 'grant')),
    -- 어느 작업 때문인지. 충전에는 없다.
    job_id     BIGINT          NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_account ON credit_ledger (account_id, created_at DESC);
-- 같은 작업으로 두 번 깎거나 두 번 돌려주지 않는다. 콜백은 여러 번 온다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_job_reason
    ON credit_ledger (job_id, reason) WHERE job_id IS NOT NULL;

/* 생성 작업.

   상태는 넷이다.
     queued   대기. 워커가 집기를 기다린다
     running  워커가 잡았다. worker_id 와 started_at 이 채워진다
     done     끝났다. asset_id 가 붙는다
     failed   실패했다. error 가 남고 크레딧을 되돌린다

   worker_id 를 남기는 이유는 회수 때문이다. 워커가 작업을 잡은 채로 죽으면
   그 작업은 running 에 영원히 남는다. started_at 이 타임아웃을 넘긴 것을
   리더가 queued 로 되돌린다. */
CREATE TABLE IF NOT EXISTS gen_jobs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id  BIGINT       NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status      VARCHAR(16)  NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'done', 'failed')),
    prompt      VARCHAR(500) NOT NULL,
    -- 스타일라이즈 / 사실적 같은 방향. 제공자마다 이름이 달라 우리 말로 둔다.
    art_style   VARCHAR(32)  NOT NULL,
    provider    VARCHAR(32)  NOT NULL DEFAULT 'meshy',
    -- 제공자가 준 작업 id. 폴링할 때 쓴다.
    provider_ref VARCHAR(128)    NULL,
    credits     INTEGER      NOT NULL CHECK (credits > 0),
    -- 높을수록 먼저. 지금은 다 0 이지만 유료 우선 처리를 넣을 자리다.
    priority    SMALLINT     NOT NULL DEFAULT 0,
    -- 재시도를 미룰 때 쓴다. 지수 백오프가 여기 들어간다.
    run_after   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    attempts    SMALLINT     NOT NULL DEFAULT 0,
    worker_id   VARCHAR(64)      NULL,
    -- 끝나면 붙는 것들
    asset_id    BIGINT           NULL REFERENCES assets(id) ON DELETE SET NULL,
    error       VARCHAR(300)     NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    started_at  TIMESTAMPTZ      NULL,
    finished_at TIMESTAMPTZ      NULL
);

-- 워커가 집는 질의가 타는 인덱스. 조건과 정렬이 그대로 들어가야 한다.
CREATE INDEX IF NOT EXISTS idx_jobs_pickup
    ON gen_jobs (priority DESC, id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_jobs_account ON gen_jobs (account_id, created_at DESC);
-- 회수가 훑는 범위. running 만 본다.
CREATE INDEX IF NOT EXISTS idx_jobs_running ON gen_jobs (started_at) WHERE status = 'running';

-- 원장이 작업을 가리킨다. 테이블 생성 순서 때문에 뒤에 건다.
ALTER TABLE credit_ledger
    ADD CONSTRAINT fk_ledger_job FOREIGN KEY (job_id) REFERENCES gen_jobs(id) ON DELETE SET NULL;

/* 가입하면 크레딧을 조금 준다. 눌러 보지도 못하면 무엇인지 알 수가 없다. */
INSERT INTO credit_ledger (account_id, delta, reason)
SELECT id, 20, 'signup' FROM accounts
ON CONFLICT DO NOTHING;
