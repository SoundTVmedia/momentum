-- comments was created with `id SERIAL PRIMARY KEY`. SQLite does not auto-generate values for
-- SERIAL, so comment ids were NULL and the client normalized them to 0. Reporting, replies, and
-- loading a newly-created comment by id consequently could not find the row. Preserve each
-- comment's SQLite rowid as its real integer primary key.

CREATE TABLE comments_rebuilt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  mocha_user_id TEXT NOT NULL,
  parent_comment_id INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_hidden INTEGER NOT NULL DEFAULT 0
);

INSERT INTO comments_rebuilt (
  id, clip_id, mocha_user_id, parent_comment_id, content, created_at, updated_at, is_hidden
)
SELECT
  rowid,
  clip_id,
  mocha_user_id,
  parent_comment_id,
  content,
  created_at,
  updated_at,
  COALESCE(is_hidden, 0)
FROM comments;

DROP TABLE comments;

ALTER TABLE comments_rebuilt RENAME TO comments;

CREATE INDEX IF NOT EXISTS idx_comments_clip_id ON comments(clip_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_hidden ON comments(is_hidden);
