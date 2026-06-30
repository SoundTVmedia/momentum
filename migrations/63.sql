-- Canonical email → mocha_user_id index for cross-provider account linking.
-- Backfills existing auth tables; Mocha Google users are indexed on next session.
CREATE TABLE IF NOT EXISTS user_emails (
  email TEXT PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_emails_mocha_user_id ON user_emails(mocha_user_id);

INSERT OR IGNORE INTO user_emails (email, mocha_user_id, source)
SELECT email, id, 'email' FROM email_accounts WHERE email IS NOT NULL AND trim(email) != '';

INSERT OR IGNORE INTO user_emails (email, mocha_user_id, source)
SELECT email, id, 'google' FROM google_accounts WHERE email IS NOT NULL AND trim(email) != '';

INSERT OR IGNORE INTO user_emails (email, mocha_user_id, source)
SELECT email, id, 'apple' FROM apple_accounts WHERE email IS NOT NULL AND trim(email) != '';
