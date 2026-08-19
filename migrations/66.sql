-- clip_flags was created with `id SERIAL PRIMARY KEY`. SQLite has no SERIAL type, so the column
-- was never a rowid alias and every inserted flag got a NULL id — the admin review endpoint
-- (WHERE id = ?) could never match one. Rebuild it with a real autoincrement id and backfill
-- existing rows from rowid.

CREATE TABLE clip_flags_rebuilt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  is_urgent INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO clip_flags_rebuilt (
  id, clip_id, reported_by, reason, details, status, is_urgent, reviewed_by, reviewed_at, created_at, updated_at
)
SELECT
  rowid,
  clip_id,
  reported_by,
  reason,
  details,
  COALESCE(status, 'pending'),
  COALESCE(is_urgent, 0),
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
FROM clip_flags;

DROP TABLE clip_flags;

ALTER TABLE clip_flags_rebuilt RENAME TO clip_flags;

CREATE INDEX IF NOT EXISTS idx_clip_flags_clip_id ON clip_flags(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_flags_status ON clip_flags(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clip_flags_reporter ON clip_flags(clip_id, reported_by);
