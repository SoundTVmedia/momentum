-- User-marked shows: planning to attend vs. already attended (JamBase event keyed).
CREATE TABLE IF NOT EXISTS user_show_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('going', 'attended')),
  jambase_event_id TEXT NOT NULL,
  jambase_venue_id TEXT,
  jambase_artist_id TEXT,
  event_title TEXT,
  artist_name TEXT,
  venue_name TEXT,
  venue_location TEXT,
  start_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mocha_user_id, jambase_event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_show_marks_user_status
ON user_show_marks (mocha_user_id, status, start_date);

CREATE INDEX IF NOT EXISTS idx_user_show_marks_user_venue
ON user_show_marks (mocha_user_id, jambase_venue_id);
