-- Unified favorites (artist | venue | song | archival_show) plus archival show metadata.
-- Artists and venues stay dual-written to user_favorite_artists / follows.

CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  favorite_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  display_name TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mocha_user_id, favorite_type, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_type
  ON user_favorites (mocha_user_id, favorite_type);

ALTER TABLE user_show_marks ADD COLUMN is_user_supplied INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_show_marks ADD COLUMN setlist_notes TEXT;
ALTER TABLE user_show_marks ADD COLUMN stub_image_url TEXT;
ALTER TABLE user_show_marks ADD COLUMN stub_r2_key TEXT;
