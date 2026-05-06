-- JamBase upstream usage: one row `jam:upstream` (total non-cache calls), see jambase-client.ts.
CREATE TABLE IF NOT EXISTS jambase_api_usage (
  bucket_id TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
