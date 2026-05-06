CREATE TABLE IF NOT EXISTS clip_show_resolve_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  match TEXT NOT NULL,
  radius_miles REAL NOT NULL,
  raw_event_count INTEGER NOT NULL DEFAULT 0,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  geo_city_id TEXT,
  source TEXT,
  notice TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_show_resolve_telemetry_created_at
  ON clip_show_resolve_telemetry(created_at DESC);
