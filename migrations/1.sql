
CREATE TABLE user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'fan',
  display_name TEXT,
  bio TEXT,
  location TEXT,
  profile_image_url TEXT,
  cover_image_url TEXT,
  city TEXT,
  genres TEXT,
  social_links TEXT,
  is_verified BOOLEAN DEFAULT 0,
  is_premium BOOLEAN DEFAULT 0,
  commission_rate REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_mocha_user_id ON user_profiles(mocha_user_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_city ON user_profiles(city);
