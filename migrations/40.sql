-- Password reset tokens for email/password accounts
CREATE TABLE IF NOT EXISTS email_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES email_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_email_password_resets_token_hash ON email_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_password_resets_user_id ON email_password_resets(user_id);
