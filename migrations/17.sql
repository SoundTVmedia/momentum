
CREATE TABLE verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  social_links TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at DATETIME,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_requests_user ON verification_requests(mocha_user_id);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);
