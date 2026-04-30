-- Table for tracking profile views
CREATE TABLE IF NOT EXISTS profile_views (
  id SERIAL PRIMARY KEY,
  profile_user_id TEXT NOT NULL,
  viewer_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking daily active users
CREATE TABLE IF NOT EXISTS daily_active_users (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  activity_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mocha_user_id, activity_date)
);

-- Table for tracking clip shares
CREATE TABLE IF NOT EXISTS clip_shares (
  id SERIAL PRIMARY KEY,
  clip_id INTEGER NOT NULL,
  shared_by TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_user ON profile_views(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_created_at ON profile_views(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_active_users_date ON daily_active_users(activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_active_users_user ON daily_active_users(mocha_user_id);
CREATE INDEX IF NOT EXISTS idx_clip_shares_clip ON clip_shares(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_shares_created_at ON clip_shares(created_at);
