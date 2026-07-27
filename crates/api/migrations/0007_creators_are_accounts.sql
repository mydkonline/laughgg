-- 창작자를 계정에 묶는다.
--
-- 지금은 에셋을 올릴 때 creator_handle 을 문자열로 받는다. 로그인도 필요 없고
-- 남의 이름을 그대로 적어도 통과한다 — 정산 대상이 문자열 하나로 정해지는데
-- 그 문자열을 아무나 고를 수 있다는 뜻이다.
--
-- 계정 하나가 창작자 하나를 갖는다. 계정 없이 만들어진 기존 창작자는 그대로
-- 두되 account_id 를 비워 둔다. 시드 데이터라 지우면 에셋이 같이 사라진다.

ALTER TABLE creators
    ADD COLUMN IF NOT EXISTS account_id BIGINT NULL
    REFERENCES accounts(id) ON DELETE CASCADE;

-- 계정 하나에 창작자 하나. 둘이면 정산이 어디로 갈지 정할 수 없다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_account
    ON creators (account_id) WHERE account_id IS NOT NULL;
