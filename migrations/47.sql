-- Direct Google OAuth accounts (when not using Mocha Users Service)
CREATE TABLE IF NOT EXISTS google_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_accounts_email ON google_accounts(email);

CREATE TABLE IF NOT EXISTS google_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES google_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_google_sessions_user ON google_sessions(user_id);
