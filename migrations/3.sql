
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  parent_comment_id INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_clip_id ON comments(clip_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_comment_id);
