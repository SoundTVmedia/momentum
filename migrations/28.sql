
-- Points and gamification system
CREATE TABLE user_points (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mocha_user_id)
);

CREATE TABLE point_transactions (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  points_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  related_clip_id INTEGER,
  related_comment_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_url TEXT,
  points_required INTEGER,
  badge_type TEXT NOT NULL,
  criteria TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_badges (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  badge_id INTEGER NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mocha_user_id, badge_id)
);

-- Live polls system
CREATE TABLE live_polls (
  id SERIAL PRIMARY KEY,
  live_session_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE live_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL,
  mocha_user_id TEXT,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(poll_id, mocha_user_id)
);

CREATE INDEX idx_user_points_user ON user_points(mocha_user_id);
CREATE INDEX idx_point_transactions_user ON point_transactions(mocha_user_id);
CREATE INDEX idx_user_badges_user ON user_badges(mocha_user_id);
CREATE INDEX idx_live_polls_session ON live_polls(live_session_id);
CREATE INDEX idx_live_poll_votes_poll ON live_poll_votes(poll_id);
