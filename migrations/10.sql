
CREATE TABLE live_sessions (
  id SERIAL PRIMARY KEY,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'scheduled',
  total_viewers INTEGER DEFAULT 0,
  current_clip_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_live_sessions_status ON live_sessions(status);
CREATE INDEX idx_live_sessions_start_time ON live_sessions(start_time);
