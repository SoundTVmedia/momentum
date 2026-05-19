-- Link Google OAuth `sub` to an existing email/password account (same email address).
ALTER TABLE email_accounts ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_google_sub ON email_accounts(google_sub);
