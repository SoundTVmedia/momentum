ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS earnings_balance INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);
