
CREATE TABLE user_device_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  device_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_type TEXT,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_device_tokens_user ON user_device_tokens(mocha_user_id);
CREATE INDEX idx_user_device_tokens_token ON user_device_tokens(device_token);
CREATE INDEX idx_user_device_tokens_expires ON user_device_tokens(expires_at);
