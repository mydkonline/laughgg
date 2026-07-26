-- "등급"이라는 말이 상품검사 뉘앙스라 서비스 전반에서 "배지"로 바꿨다.
-- 저장소 컬럼도 같은 이름을 쓰도록 맞춘다.
ALTER TABLE reviews DROP INDEX idx_reviews_grade;
ALTER TABLE reviews CHANGE COLUMN grade badge VARCHAR(16) NOT NULL;
CREATE INDEX idx_reviews_badge ON reviews (badge);
