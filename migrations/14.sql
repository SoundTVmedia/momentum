-- D1/SQLite does not support "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" (parse error near EXISTS).
-- live_chat_messages moderation columns and user_profiles admin flags are created in migration 12.
-- This file remains for ordering; only idempotent live_chat_bans setup runs here.

CREATE TABLE IF NOT EXISTS live_chat_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_session_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(live_session_id, mocha_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_bans_session ON live_chat_bans(live_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_bans_user ON live_chat_bans(mocha_user_id);
