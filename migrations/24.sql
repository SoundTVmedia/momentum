-- Add columns to store Cloudflare Stream video data
ALTER TABLE clips ADD COLUMN IF NOT EXISTS stream_video_id TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS stream_playback_url TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS stream_thumbnail_url TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'ready';
ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_duration INTEGER;

-- Create index for stream video status
CREATE INDEX IF NOT EXISTS idx_clips_video_status ON clips(video_status);
