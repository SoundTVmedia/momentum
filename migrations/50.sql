-- Cached YouTube official channel per artist (resolved via Data API)
ALTER TABLE artists ADD COLUMN youtube_channel_id TEXT;

CREATE INDEX IF NOT EXISTS idx_artists_youtube_channel_id
ON artists(youtube_channel_id)
WHERE youtube_channel_id IS NOT NULL AND TRIM(youtube_channel_id) != '';
