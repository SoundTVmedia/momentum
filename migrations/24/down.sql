
DROP INDEX idx_clips_video_status;
ALTER TABLE clips DROP COLUMN video_duration;
ALTER TABLE clips DROP COLUMN video_status;
ALTER TABLE clips DROP COLUMN stream_thumbnail_url;
ALTER TABLE clips DROP COLUMN stream_playback_url;
ALTER TABLE clips DROP COLUMN stream_video_id;
