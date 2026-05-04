-- Base table was missing from earlier migrations; 12 previously only ALTERed it.
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_session_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  deleted_by TEXT,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session ON live_chat_messages(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_created ON live_chat_messages(created_at);

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

ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN is_moderator BOOLEAN DEFAULT false;
