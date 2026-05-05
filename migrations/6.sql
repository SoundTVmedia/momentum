
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  related_user_id TEXT,
  related_clip_id INTEGER,
  related_comment_id INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(mocha_user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
