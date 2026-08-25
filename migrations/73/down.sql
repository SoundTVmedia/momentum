DROP INDEX IF EXISTS idx_user_favorites_user_type;
DROP TABLE IF EXISTS user_favorites;

ALTER TABLE user_show_marks DROP COLUMN is_user_supplied;
ALTER TABLE user_show_marks DROP COLUMN setlist_notes;
ALTER TABLE user_show_marks DROP COLUMN stub_image_url;
ALTER TABLE user_show_marks DROP COLUMN stub_r2_key;
