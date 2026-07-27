/* 마켓 카탈로그를 DB 에 넣는다.

   지금까지 마켓과 상품 페이지는 앱 안의 `data/pieces.ts` 를 그렸고, DB 에는
   올라온 것만 있었다. 화면과 서버가 서로 다른 목록을 들고 있었다는 뜻이다.
   장바구니가 생기면서 그 틈이 드러났다 — 상품 페이지에서 담으면 화면 id 가
   들어가는데 서버는 그 id 로 다른 물건을 찾거나 못 찾는다.

   **id 를 맞춘다.** 카탈로그의 id 를 그대로 쓴다. 마켓은 지금처럼 로컬에서
   3D 를 구워 빠르게 그리고, 장바구니와 결제와 라이브러리는 같은 id 로 서버를
   본다. 한 물건에 번호가 하나다.

   이 SQL 은 `data/pieces.ts` 에서 뽑아 만들었다. 손으로 옮기면 다음에 하나
   고칠 때 한쪽만 고친 채로 갈린다.

   화풍은 카탈로그에 없어서 우리가 정했다 — 도트 스프라이트는 pixel,
   나머지 glTF 는 realistic 이다. 출처는 전부 CC0 라 public_domain 이다
   (저장소 루트 CREDITS.md).

   엔진은 배열이다. 카탈로그의 상품은 대개 두세 엔진을 같이 지원하는데,
   한 칸에 하나만 적으면 장바구니에서 "UNITY" 라고만 보이고 언리얼에서도
   쓸 수 있다는 걸 사는 사람이 모른다. 기존 `engine` 칸은 필터가 쓰던
   대표값으로 그대로 두고, 실제 목록을 옆에 둔다. */

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS engines TEXT[] NOT NULL DEFAULT '{}';

-- 이미 있던 줄은 대표값 하나짜리 목록으로 채운다.
UPDATE assets SET engines = ARRAY[engine] WHERE cardinality(engines) = 0;

-- 창작자
INSERT INTO creators (handle, display_name) VALUES ('coopers', 'Coopers')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('emberforge', 'Emberforge')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('indiesquid', 'IndieSquid')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('ironbark', 'Ironbark')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('oakmoor', 'Oakmoor')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('stonewright', 'Stonewright')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('tinsmith', 'Tinsmith')
    ON CONFLICT (handle) DO NOTHING;
INSERT INTO creators (handle, display_name) VALUES ('utumno', 'Utumno')
    ON CONFLICT (handle) DO NOTHING;

-- 에셋. id 를 카탈로그와 맞춘다.
INSERT INTO assets (id, creator_id, title, category, engine, engines, art_style, price_usd, origin)
OVERRIDING SYSTEM VALUE VALUES
    (1, (SELECT id FROM creators WHERE handle='stonewright'), 'Gothic Statue', 'env', 'unity', ARRAY['unity','unreal'], 'realistic', 38.00, 'public_domain'),
    (2, (SELECT id FROM creators WHERE handle='ironbark'), 'Kite Shield', 'weapon', 'any', ARRAY['unity','unreal','godot'], 'realistic', 24.00, 'public_domain'),
    (3, (SELECT id FROM creators WHERE handle='emberforge'), 'Lantern Chandelier', 'light', 'unity', ARRAY['unity','unreal'], 'realistic', 32.00, 'public_domain'),
    (4, (SELECT id FROM creators WHERE handle='emberforge'), 'Brass Candleholders', 'light', 'unity', ARRAY['unity'], 'realistic', 18.00, 'public_domain'),
    (5, (SELECT id FROM creators WHERE handle='ironbark'), 'Cross Pein Hammer', 'weapon', 'unreal', ARRAY['unreal','godot'], 'realistic', 12.00, 'public_domain'),
    (6, (SELECT id FROM creators WHERE handle='emberforge'), 'Lantern 01', 'light', 'unity', ARRAY['unity','unreal'], 'realistic', 16.00, 'public_domain'),
    (7, (SELECT id FROM creators WHERE handle='stonewright'), 'Horse Statue', 'env', 'unity', ARRAY['unity','unreal'], 'realistic', 34.00, 'public_domain'),
    (8, (SELECT id FROM creators WHERE handle='tinsmith'), 'Brass Goblets', 'prop', 'unity', ARRAY['unity'], 'realistic', 9.00, 'public_domain'),
    (9, (SELECT id FROM creators WHERE handle='oakmoor'), 'Gothic Cabinet', 'furniture', 'unity', ARRAY['unity','unreal'], 'realistic', 28.00, 'public_domain'),
    (10, (SELECT id FROM creators WHERE handle='stonewright'), 'Bronze Statue', 'env', 'unreal', ARRAY['unreal'], 'realistic', 22.00, 'public_domain'),
    (11, (SELECT id FROM creators WHERE handle='emberforge'), 'Chandelier 01', 'light', 'any', ARRAY['unity','unreal','godot'], 'realistic', 26.00, 'public_domain'),
    (12, (SELECT id FROM creators WHERE handle='oakmoor'), 'Gothic Table', 'furniture', 'unity', ARRAY['unity'], 'realistic', 15.00, 'public_domain'),
    (13, (SELECT id FROM creators WHERE handle='coopers'), 'Barrel 03', 'prop', 'any', ARRAY['unity','unreal','godot'], 'realistic', 7.00, 'public_domain'),
    (14, (SELECT id FROM creators WHERE handle='oakmoor'), 'Wooden Table', 'furniture', 'unity', ARRAY['unity','godot'], 'realistic', 11.00, 'public_domain'),
    (15, (SELECT id FROM creators WHERE handle='tinsmith'), 'Metal Jug', 'prop', 'godot', ARRAY['godot'], 'realistic', 6.00, 'public_domain'),
    (16, (SELECT id FROM creators WHERE handle='oakmoor'), 'Wooden Chair', 'furniture', 'unity', ARRAY['unity','unreal'], 'realistic', 8.00, 'public_domain'),
    (17, (SELECT id FROM creators WHERE handle='tinsmith'), 'Ceramic Pot', 'prop', 'unity', ARRAY['unity'], 'realistic', 5.00, 'public_domain'),
    (18, (SELECT id FROM creators WHERE handle='tinsmith'), 'Jug 01', 'prop', 'godot', ARRAY['godot'], 'realistic', 4.00, 'public_domain'),
    (19, (SELECT id FROM creators WHERE handle='stonewright'), 'Coast Rocks', 'env', 'any', ARRAY['unity','unreal','godot'], 'realistic', 0.00, 'public_domain'),
    (20, (SELECT id FROM creators WHERE handle='tinsmith'), 'Brass Pot', 'prop', 'unity', ARRAY['unity'], 'realistic', 3.00, 'public_domain'),
    (21, (SELECT id FROM creators WHERE handle='indiesquid'), 'Isometric House Set', 'env', 'unity', ARRAY['unity','godot'], 'pixel', 14.00, 'public_domain'),
    (22, (SELECT id FROM creators WHERE handle='indiesquid'), 'Isometric Tree Pack', 'env', 'unity', ARRAY['unity','godot'], 'pixel', 14.00, 'public_domain'),
    (23, (SELECT id FROM creators WHERE handle='indiesquid'), 'Isometric Road Tiles', 'env', 'godot', ARRAY['godot'], 'pixel', 11.00, 'public_domain'),
    (24, (SELECT id FROM creators WHERE handle='indiesquid'), 'Isometric Bridge', 'env', 'unity', ARRAY['unity','godot'], 'pixel', 11.00, 'public_domain'),
    (25, (SELECT id FROM creators WHERE handle='utumno'), 'Ruin Layer Set', 'env', 'any', ARRAY['unity','unreal','godot'], 'pixel', 19.00, 'public_domain'),
    (26, (SELECT id FROM creators WHERE handle='utumno'), 'Crypt Layer Set', 'env', 'unity', ARRAY['unity','godot'], 'pixel', 19.00, 'public_domain'),
    (27, (SELECT id FROM creators WHERE handle='utumno'), 'Dungeon Wall Tiles', 'env', 'unity', ARRAY['unity','godot'], 'pixel', 8.00, 'public_domain');

-- 채점. 항목이 전부 같은 값이면 총점도 그 값이다.
INSERT INTO reviews (asset_id, mesh_integrity, texture_quality, lod_setup,
                     runtime_cost, license_clean, code_quality, integration, total, badge)
VALUES
    (1, 94, 94, 94, 94, 94, 94, 94, 94, 'challenger'),
    (2, 92, 92, 92, 92, 92, 92, 92, 92, 'challenger'),
    (3, 91, 91, 91, 91, 91, 91, 91, 91, 'challenger'),
    (4, 90, 90, 90, 90, 90, 90, 90, 90, 'challenger'),
    (5, 88, 88, 88, 88, 88, 88, 88, 88, 'diamond'),
    (6, 87, 87, 87, 87, 87, 87, 87, 87, 'diamond'),
    (7, 85, 85, 85, 85, 85, 85, 85, 85, 'diamond'),
    (8, 84, 84, 84, 84, 84, 84, 84, 84, 'diamond'),
    (9, 83, 83, 83, 83, 83, 83, 83, 83, 'diamond'),
    (10, 82, 82, 82, 82, 82, 82, 82, 82, 'diamond'),
    (11, 81, 81, 81, 81, 81, 81, 81, 81, 'diamond'),
    (12, 80, 80, 80, 80, 80, 80, 80, 80, 'diamond'),
    (13, 78, 78, 78, 78, 78, 78, 78, 78, 'platinum'),
    (14, 77, 77, 77, 77, 77, 77, 77, 77, 'platinum'),
    (15, 76, 76, 76, 76, 76, 76, 76, 76, 'platinum'),
    (16, 75, 75, 75, 75, 75, 75, 75, 75, 'platinum'),
    (17, 74, 74, 74, 74, 74, 74, 74, 74, 'platinum'),
    (18, 72, 72, 72, 72, 72, 72, 72, 72, 'platinum'),
    (19, 70, 70, 70, 70, 70, 70, 70, 70, 'platinum'),
    (20, 66, 66, 66, 66, 66, 66, 66, 66, 'silver'),
    (21, 89, 89, 89, 89, 89, 89, 89, 89, 'diamond'),
    (22, 86, 86, 86, 86, 86, 86, 86, 86, 'diamond'),
    (23, 84, 84, 84, 84, 84, 84, 84, 84, 'diamond'),
    (24, 82, 82, 82, 82, 82, 82, 82, 82, 'diamond'),
    (25, 80, 80, 80, 80, 80, 80, 80, 80, 'diamond'),
    (26, 78, 78, 78, 78, 78, 78, 78, 78, 'platinum'),
    (27, 76, 76, 76, 76, 76, 76, 76, 76, 'platinum');

ALTER TABLE assets ALTER COLUMN id RESTART WITH 1000;
