-- Content moderation tables
CREATE TABLE clip_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clip_flags_clip_id ON clip_flags(clip_id);
CREATE INDEX idx_clip_flags_status ON clip_flags(status);

CREATE TABLE user_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  reason TEXT,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_bans_user_id ON user_bans(mocha_user_id);

-- Add hidden flag to clips
ALTER TABLE clips ADD COLUMN is_hidden BOOLEAN DEFAULT 0;
CREATE INDEX idx_clips_hidden ON clips(is_hidden);