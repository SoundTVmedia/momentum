-- YouTube Data API: daily upstream unit budget + JSON response cache (see youtube-cache.ts).
CREATE TABLE IF NOT EXISTS youtube_api_usage (
  bucket_id TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS youtube_response_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_youtube_response_cache_expires ON youtube_response_cache(expires_at);
