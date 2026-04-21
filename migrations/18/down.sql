
-- Remove performance indexes

DROP INDEX IF EXISTS idx_user_profiles_verified;
DROP INDEX IF EXISTS idx_notifications_created;
DROP INDEX IF EXISTS idx_notifications_user_read;
DROP INDEX IF EXISTS idx_saved_clips_user_id;
DROP INDEX IF EXISTS idx_clip_likes_created;
DROP INDEX IF EXISTS idx_clip_likes_user_id;
DROP INDEX IF EXISTS idx_comments_user_id;
DROP INDEX IF EXISTS idx_clips_trending;
DROP INDEX IF EXISTS idx_clips_user_id;
