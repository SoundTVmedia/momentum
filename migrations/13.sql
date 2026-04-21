
CREATE TABLE live_session_viewers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_session_id INTEGER NOT NULL,
  mocha_user_id TEXT,
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(live_session_id, mocha_user_id)
);

CREATE INDEX idx_live_session_viewers_session ON live_session_viewers(live_session_id);
CREATE INDEX idx_live_session_viewers_heartbeat ON live_session_viewers(last_heartbeat);
