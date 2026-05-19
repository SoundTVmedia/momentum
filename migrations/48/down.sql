DROP INDEX IF EXISTS idx_email_accounts_google_sub;

-- SQLite does not support DROP COLUMN; recreate table without google_sub if rollback is required.
-- For local dev rollback, prefer restoring from backup.
