ALTER TABLE clips ADD COLUMN content_feed TEXT DEFAULT 'main';
ALTER TABLE clips ADD COLUMN acr_matched INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN has_speech INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN headliner_matched INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clips_content_feed_created
ON clips(content_feed, created_at DESC)
WHERE is_hidden = 0 AND is_draft = 0;

CREATE TABLE IF NOT EXISTS clip_content_classifications (
  id TEXT PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  content_feed TEXT NOT NULL,
  acr_matched INTEGER NOT NULL DEFAULT 0,
  has_speech INTEGER NOT NULL DEFAULT 0,
  headliner_matched INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  acr_artist TEXT,
  acr_title TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_content_classifications_user_expires
ON clip_content_classifications(mocha_user_id, expires_at);
