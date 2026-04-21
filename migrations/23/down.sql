
DROP INDEX idx_user_profiles_stripe_customer;
ALTER TABLE user_profiles DROP COLUMN earnings_balance;
ALTER TABLE user_profiles DROP COLUMN stripe_account_id;
ALTER TABLE user_profiles DROP COLUMN stripe_customer_id;
