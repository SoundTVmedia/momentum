ALTER TABLE live_chat_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE live_chat_messages 
ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE live_chat_messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS live_chat_bans (
  id SERIAL PRIMARY KEY,
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

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT false;
