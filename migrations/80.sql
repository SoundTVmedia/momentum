-- artists was created with `id SERIAL PRIMARY KEY`. SQLite does not treat SERIAL as a
-- rowid alias, so inserts left id NULL. Artist pages then followed `artist-0` and the
-- endpoint could not resolve the row. Rebuild with a real integer primary key, preserving
-- each row's SQLite rowid (the value D1 already returned as last_row_id).
-- youtube_channel_id is re-added empty; the YouTube lookup fills it again on the next visit.

CREATE TABLE artists_rebuilt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  bio TEXT,
  image_url TEXT,
  social_links TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  youtube_channel_id TEXT
);

INSERT INTO artists_rebuilt (
  id, name, bio, image_url, social_links, is_verified, created_at, updated_at
)
SELECT
  rowid,
  name,
  bio,
  image_url,
  social_links,
  is_verified,
  created_at,
  updated_at
FROM artists;

DROP TABLE artists;

ALTER TABLE artists_rebuilt RENAME TO artists;

CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_youtube_channel_id
ON artists(youtube_channel_id)
WHERE youtube_channel_id IS NOT NULL AND TRIM(youtube_channel_id) != '';
