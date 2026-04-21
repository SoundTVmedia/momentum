
CREATE TABLE saved_clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clip_id, mocha_user_id)
);

CREATE INDEX idx_saved_clips_user ON saved_clips(mocha_user_id);
