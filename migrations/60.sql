-- Resilient clip upload: server-side session tracking + clip upload status.

ALTER TABLE clips ADD COLUMN upload_status TEXT DEFAULT 'ready';
ALTER TABLE clips ADD COLUMN r2_raw_key TEXT;

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  clip_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  multipart_upload_id TEXT NOT NULL,
  total_parts INTEGER NOT NULL,
  completed_parts TEXT NOT NULL DEFAULT '[]',
  file_size INTEGER,
  content_type TEXT,
  file_name TEXT,
  thumbnail_key TEXT,
  thumbnail_url TEXT,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_sessions_idempotency
ON upload_sessions (idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_upload_sessions_status
ON upload_sessions (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_clips_upload_status
ON clips (upload_status, updated_at)
WHERE upload_status NOT IN ('ready', 'pending');
