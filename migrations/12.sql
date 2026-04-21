
CREATE TABLE live_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_session_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_live_chat_messages_session ON live_chat_messages(live_session_id);
CREATE INDEX idx_live_chat_messages_created ON live_chat_messages(created_at DESC);
