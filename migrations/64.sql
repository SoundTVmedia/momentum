-- Short-lived OAuth state for native app flows (Browser / custom URL scheme; no shared cookies).
CREATE TABLE IF NOT EXISTS oauth_pending_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_pending_states_expires
  ON oauth_pending_states (expires_at);
