-- venues was created with `id SERIAL PRIMARY KEY`. SQLite does not treat SERIAL as a rowid
-- alias, so inserts left id NULL even though D1 returned a valid last_row_id. Venue pages then
-- exposed id 0 and the follow endpoint rejected them. Rebuild with a real integer primary key,
-- preserving each row's SQLite rowid (the value existing tour-date writes already used).

CREATE TABLE venues_rebuilt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  address TEXT,
  image_url TEXT,
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  jambase_id TEXT
);

INSERT INTO venues_rebuilt (
  id, name, location, address, image_url, capacity, created_at, updated_at, jambase_id
)
SELECT
  rowid,
  name,
  location,
  address,
  image_url,
  capacity,
  created_at,
  updated_at,
  jambase_id
FROM venues;

DROP TABLE venues;

ALTER TABLE venues_rebuilt RENAME TO venues;

CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_jambase_id_unique
ON venues(jambase_id)
WHERE jambase_id IS NOT NULL AND LENGTH(TRIM(jambase_id)) > 0;
