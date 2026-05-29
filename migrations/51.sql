-- Permanent venue logo cache (JamBase id + official website host). First resolved logo is kept forever.
CREATE TABLE IF NOT EXISTS venue_logo_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  jambase_id TEXT,
  website_url TEXT,
  logo_url TEXT,
  source TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_venue_logo_cache_jambase ON venue_logo_cache(jambase_id);
