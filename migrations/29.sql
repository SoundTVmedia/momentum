
-- GDPR compliance tables
CREATE TABLE account_deletion_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  requested_at DATETIME,
  processed_at DATETIME,
  processed_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_privacy_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL UNIQUE,
  profile_visibility TEXT DEFAULT 'public',
  allow_tagging BOOLEAN DEFAULT 1,
  show_online_status BOOLEAN DEFAULT 1,
  email_notifications BOOLEAN DEFAULT 1,
  push_notifications BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticketmaster affiliate tracking
CREATE TABLE affiliate_ticket_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  referrer_user_id TEXT,
  event_id TEXT NOT NULL,
  event_name TEXT,
  event_date DATETIME,
  venue_name TEXT,
  ticket_url TEXT NOT NULL,
  estimated_price INTEGER,
  quantity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics
CREATE TABLE api_performance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX idx_ticket_clicks_referrer ON affiliate_ticket_clicks(referrer_user_id);
CREATE INDEX idx_performance_endpoint ON api_performance_logs(endpoint, created_at);
