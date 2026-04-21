
-- Create user_favorite_artists table
CREATE TABLE user_favorite_artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  artist_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mocha_user_id, artist_id)
);

CREATE INDEX idx_favorite_artists_user_id ON user_favorite_artists(mocha_user_id);
CREATE INDEX idx_favorite_artists_artist_id ON user_favorite_artists(artist_id);
