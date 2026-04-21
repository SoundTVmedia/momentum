
ALTER TABLE live_chat_messages ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE live_chat_messages ADD COLUMN deleted_by TEXT;
ALTER TABLE live_chat_messages ADD COLUMN deleted_at DATETIME;

CREATE TABLE live_chat_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_session_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  reason TEXT,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(live_session_id, mocha_user_id)
);

CREATE INDEX idx_chat_bans_session ON live_chat_bans(live_session_id);
CREATE INDEX idx_chat_bans_user ON live_chat_bans(mocha_user_id);

ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN is_moderator BOOLEAN DEFAULT 0;
