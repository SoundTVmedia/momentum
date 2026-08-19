-- User-facing reporting and blocking: comment/profile flags, block list, comment hiding.

CREATE TABLE IF NOT EXISTS user_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_pair ON user_blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

CREATE TABLE IF NOT EXISTS comment_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  is_urgent INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comment_flags_comment_id ON comment_flags(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_flags_status ON comment_flags(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_flags_reporter ON comment_flags(comment_id, reported_by);

CREATE TABLE IF NOT EXISTS profile_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reported_user_id TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  is_urgent INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_flags_user ON profile_flags(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_flags_status ON profile_flags(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_flags_reporter ON profile_flags(reported_user_id, reported_by);

ALTER TABLE comments ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_comments_hidden ON comments(is_hidden);

ALTER TABLE clip_flags ADD COLUMN details TEXT;
ALTER TABLE clip_flags ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0;
