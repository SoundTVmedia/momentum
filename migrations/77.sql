-- User-added past shows from the JamBase archive (cards/pages with zero clips).
CREATE TABLE IF NOT EXISTS library_shows (
  jambase_event_id TEXT PRIMARY KEY NOT NULL,
  artist_name TEXT NOT NULL,
  venue_name TEXT,
  venue_location TEXT,
  start_date TEXT,
  event_title TEXT,
  thumbnail_url TEXT,
  jambase_artist_id TEXT,
  jambase_venue_id TEXT,
  setlist_json TEXT,
  payload TEXT,
  added_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_library_shows_artist
  ON library_shows(artist_name);
CREATE INDEX IF NOT EXISTS idx_library_shows_venue
  ON library_shows(venue_name);
CREATE INDEX IF NOT EXISTS idx_library_shows_start
  ON library_shows(start_date);
