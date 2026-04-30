-- Drop table if it already exists (optional, comment out if not needed)
-- DROP TABLE IF EXISTS user_profiles;

CREATE TABLE IF NOT EXISTS user_profiles (
  id            SERIAL          PRIMARY KEY,
  mocha_user_id TEXT            NOT NULL UNIQUE,
  role          TEXT            NOT NULL DEFAULT 'fan',
  display_name  TEXT,
  bio           TEXT,
  location      TEXT,
  profile_image_url TEXT,
  cover_image_url   TEXT,
  city          TEXT,
  genres        TEXT,
  social_links  TEXT,
  is_verified   BOOLEAN         DEFAULT FALSE,
  is_premium    BOOLEAN         DEFAULT FALSE,
  commission_rate DOUBLE PRECISION,
  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_mocha_user_id ON user_profiles(mocha_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role          ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_city          ON user_profiles(city);
