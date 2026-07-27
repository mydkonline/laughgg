/* 주문 하나에 에셋 여럿.

   지금까지 orders 한 줄이 곧 에셋 하나였다. 상세 페이지에서 바로 사는
   길밖에 없었으니 그걸로 됐는데, 장바구니가 생기면 그 모델이 깨진다 —
   세 점을 한 번에 결제하면 주문은 하나고 물건이 셋이다.

   줄을 셋 만들고 provider_ref 를 셋에 나눠 붙이는 방법도 있었다. 그러면
   주문 내역에 한 번 산 것이 세 줄로 뜨고, 결제 하나가 부분적으로만
   확정되는 상태가 생긴다. 머리(주문)와 줄(품목)을 나누는 게 맞다.

   금액은 두 군데에 박힌다. 품목에는 그때 그 에셋의 값, 머리에는 그 합.
   합을 매번 세어도 되지만 Stripe 에 보낸 금액이 무엇이었는지는 그 시점
   그대로 남아 있어야 한다 — 가격이 나중에 바뀌면 세어 낸 값이 달라진다. */

CREATE TABLE IF NOT EXISTS order_items (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id     BIGINT  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    asset_id     BIGINT  NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0)
);

/* 한 주문에 같은 에셋이 두 줄일 수 없다.

   수량이 없기 때문이다. 에셋은 파일이라 두 개를 사도 받는 것이 같다 —
   두 번 받아 봐야 같은 파일이고, 두 번 계산되면 그냥 두 배로 낸 것이다. */
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_unique
    ON order_items (order_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_order_items_asset ON order_items (asset_id);

-- 지난 주문을 품목으로 옮긴다. 한 줄에 하나씩이라 그대로 내려간다.
INSERT INTO order_items (order_id, asset_id, amount_cents)
SELECT id, asset_id, amount_cents FROM orders
ON CONFLICT DO NOTHING;

/* 이제 asset_id 는 머리에 없다.

   남겨 두면 "첫 번째 품목" 같은 뜻으로 계속 읽히고, 어느 쪽이 진짜인지
   묻게 된다. 옮겼으면 지운다. */
ALTER TABLE orders DROP COLUMN IF EXISTS asset_id;

/* 판매는 주문이 아니라 품목에서 나온다.

   sales.order_id 에 걸린 유일 인덱스가 주문당 판매 한 건만 허용했다.
   세 점짜리 주문이면 판매도 세 건이라 그 제약이 그대로면 두 건이 조용히
   버려진다 — 창작자 둘이 정산을 못 받는다. */
DROP INDEX IF EXISTS idx_sales_order;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_order_item
    ON sales (order_id, asset_id) WHERE order_id IS NOT NULL;
