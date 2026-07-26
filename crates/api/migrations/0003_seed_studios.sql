-- 구독 스튜디오 시드. name 이 유일키라 재실행해도 늘지 않는다.
INSERT INTO studios (name, plan, monthly_krw) VALUES
 ('Nordveil Studio','standard',490000),
 ('Ashfall Games','standard',490000),
 ('Pixelforge','trial',0),
 ('Lumen Interactive','enterprise',1200000)
ON CONFLICT (name) DO NOTHING;
