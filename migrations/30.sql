-- Add rating columns to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS average_rating REAL DEFAULT 0.0;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create clip_ratings table for storing individual user ratings
CREATE TABLE IF NOT EXISTS clip_ratings (
  id SERIAL PRIMARY KEY,
  clip_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clip_id, mocha_user_id)
);

CREATE INDEX IF NOT EXISTS idx_clip_ratings_clip_id ON clip_ratings(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_ratings_user_id ON clip_ratings(mocha_user_id);
