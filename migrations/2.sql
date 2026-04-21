
CREATE TABLE clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  artist_name TEXT,
  venue_name TEXT,
  location TEXT,
  timestamp DATETIME,
  content_description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  hashtags TEXT,
  is_trending_score REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clips_mocha_user_id ON clips(mocha_user_id);
CREATE INDEX idx_clips_artist_name ON clips(artist_name);
CREATE INDEX idx_clips_venue_name ON clips(venue_name);
CREATE INDEX idx_clips_trending_score ON clips(is_trending_score DESC);
CREATE INDEX idx_clips_created_at ON clips(created_at DESC);

CREATE TABLE clip_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clip_id, mocha_user_id)
);

CREATE INDEX idx_clip_likes_clip_id ON clip_likes(clip_id);
CREATE INDEX idx_clip_likes_mocha_user_id ON clip_likes(mocha_user_id);
