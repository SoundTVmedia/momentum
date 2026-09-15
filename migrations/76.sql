-- Per-user 1–5 star ratings for a show (JamBase event id or composite show id).
CREATE TABLE IF NOT EXISTS show_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id TEXT NOT NULL,
  mocha_user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(show_id, mocha_user_id)
);

CREATE INDEX IF NOT EXISTS idx_show_ratings_show_id ON show_ratings(show_id);
