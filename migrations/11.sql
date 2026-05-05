CREATE TABLE live_session_clips (
  id SERIAL PRIMARY KEY,
  live_session_id INTEGER NOT NULL,
  clip_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  scheduled_start_time TIMESTAMP,
  duration INTEGER,
  played_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_live_session_clips_session ON live_session_clips(live_session_id);
CREATE INDEX idx_live_session_clips_order ON live_session_clips(live_session_id, order_index);
