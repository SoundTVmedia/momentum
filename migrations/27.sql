-- Add tables to support collaboration requests between artists and influencers
CREATE TABLE collaboration_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_user_id TEXT NOT NULL,
  influencer_user_id TEXT NOT NULL,
  brief TEXT NOT NULL,
  compensation TEXT NOT NULL,
  deadline DATETIME NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collaboration_requests_influencer ON collaboration_requests(influencer_user_id, status);
CREATE INDEX idx_collaboration_requests_artist ON collaboration_requests(artist_user_id, status);

-- Add table for pinned clips on artist pages
CREATE TABLE artist_pinned_clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id INTEGER NOT NULL,
  clip_id INTEGER NOT NULL,
  pinned_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artist_id, clip_id)
);

CREATE INDEX idx_artist_pinned_clips_artist ON artist_pinned_clips(artist_id);

-- Add table for tracking featured clips on Momentum Live
CREATE TABLE live_featured_clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  live_session_id INTEGER NOT NULL,
  featured_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_live_featured_clips_clip ON live_featured_clips(clip_id);
CREATE INDEX idx_live_featured_clips_session ON live_featured_clips(live_session_id);