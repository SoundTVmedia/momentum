-- Cloudflare Stream serves a progressive MP4 at /downloads/default.mp4 only after that
-- download has been explicitly generated for the video. The app built and stored that URL
-- without ever requesting generation, so it 404s: modal playback, clip download and
-- song identification all fell back or failed on any clip with a stream_video_id.
--
-- Track the MP4 that Cloudflare actually confirms, rather than assuming one exists.
-- stream_mp4_status: NULL/'pending' = not requested yet, 'inprogress' = generating,
-- 'ready' = stream_mp4_url is live, 'error' = generation refused.

ALTER TABLE clips ADD COLUMN stream_mp4_url TEXT;
ALTER TABLE clips ADD COLUMN stream_mp4_status TEXT;

-- Cron scans for clips ingested to Stream whose MP4 is not confirmed ready yet.
CREATE INDEX IF NOT EXISTS idx_clips_stream_mp4_pending
  ON clips(stream_mp4_status, updated_at);
