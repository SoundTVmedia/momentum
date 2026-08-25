-- JamBase call-reduction: permanent ID maps, event cache, geo, and daily metrics.
-- Artist/venue JamBase IDs never change; event payloads refresh on a 72h TTL
-- except past events, which are archival and never expire.

CREATE TABLE IF NOT EXISTS jambase_artist_ids (
  name_key TEXT PRIMARY KEY NOT NULL,
  jambase_id TEXT NOT NULL,
  display_name TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jambase_artist_ids_jb
  ON jambase_artist_ids(jambase_id);

CREATE TABLE IF NOT EXISTS jambase_venue_ids (
  name_key TEXT PRIMARY KEY NOT NULL,
  jambase_id TEXT NOT NULL,
  display_name TEXT,
  latitude REAL,
  longitude REAL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jambase_venue_ids_jb
  ON jambase_venue_ids(jambase_id);

CREATE TABLE IF NOT EXISTS jambase_events (
  jambase_event_id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  start_date TEXT,
  artist_jambase_id TEXT,
  venue_jambase_id TEXT,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jambase_events_artist
  ON jambase_events(artist_jambase_id);
CREATE INDEX IF NOT EXISTS idx_jambase_events_venue
  ON jambase_events(venue_jambase_id);
CREATE INDEX IF NOT EXISTS idx_jambase_events_start
  ON jambase_events(start_date);

CREATE TABLE IF NOT EXISTS jambase_event_lists (
  list_key TEXT PRIMARY KEY NOT NULL,
  event_ids TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jambase_geo_cities (
  city_key TEXT PRIMARY KEY NOT NULL,
  city_id TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jambase_cache_metrics (
  day TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  upstream_calls INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, endpoint)
);
