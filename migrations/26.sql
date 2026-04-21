
-- Table for tracking profile views
CREATE TABLE profile_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_user_id TEXT NOT NULL,
  viewer_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking daily active users
CREATE TABLE daily_active_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  activity_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mocha_user_id, activity_date)
);

-- Table for tracking clip shares
CREATE TABLE clip_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  shared_by TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_profile_views_profile_user ON profile_views(profile_user_id);
CREATE INDEX idx_profile_views_created_at ON profile_views(created_at);
CREATE INDEX idx_daily_active_users_date ON daily_active_users(activity_date);
CREATE INDEX idx_daily_active_users_user ON daily_active_users(mocha_user_id);
CREATE INDEX idx_clip_shares_clip ON clip_shares(clip_id);
CREATE INDEX idx_clip_shares_created_at ON clip_shares(created_at);
