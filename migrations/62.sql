-- Sign in with Apple (direct OAuth on Worker, mirrors google_accounts pattern)
CREATE TABLE IF NOT EXISTS apple_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  is_private_email INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_apple_accounts_email ON apple_accounts(email);

CREATE TABLE IF NOT EXISTS apple_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES apple_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_apple_sessions_user ON apple_sessions(user_id);

ALTER TABLE email_accounts ADD COLUMN apple_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_apple_sub ON email_accounts(apple_sub);
