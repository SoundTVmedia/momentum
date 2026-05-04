-- Email/password accounts (local auth alongside Mocha OAuth users)
CREATE TABLE IF NOT EXISTS email_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES email_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_email_sessions_token_hash ON email_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_sessions_user_id ON email_sessions(user_id);
