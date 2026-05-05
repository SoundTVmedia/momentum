
-- Create user_favorite_clips_by_artist table
CREATE TABLE user_favorite_clips_by_artist (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  artist_id INTEGER NOT NULL,
  clip_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mocha_user_id, artist_id, clip_id)
);

CREATE INDEX idx_favorite_clips_user_artist ON user_favorite_clips_by_artist(mocha_user_id, artist_id);
CREATE INDEX idx_favorite_clips_clip_id ON user_favorite_clips_by_artist(clip_id);
