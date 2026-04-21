
DROP INDEX idx_clip_ratings_user_id;
DROP INDEX idx_clip_ratings_clip_id;
DROP TABLE clip_ratings;
ALTER TABLE clips DROP COLUMN rating_count;
ALTER TABLE clips DROP COLUMN average_rating;
