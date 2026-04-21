-- Drop indexes first
DROP INDEX IF EXISTS idx_clips_hidden;
DROP INDEX IF EXISTS idx_user_bans_user_id;
DROP INDEX IF EXISTS idx_clip_flags_status;
DROP INDEX IF EXISTS idx_clip_flags_clip_id;

-- Drop columns
ALTER TABLE clips DROP COLUMN is_hidden;

-- Drop tables
DROP TABLE IF EXISTS user_bans;
DROP TABLE IF EXISTS clip_flags;