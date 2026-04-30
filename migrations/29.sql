-- GDPR compliance tables
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL UNIQUE,
  profile_visibility TEXT DEFAULT 'public',
  allow_tagging BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticketmaster affiliate tracking
CREATE TABLE IF NOT EXISTS affiliate_ticket_clicks (
  id SERIAL PRIMARY KEY,
  mocha_user_id TEXT NOT NULL,
  referrer_user_id TEXT,
  event_id TEXT NOT NULL,
  event_name TEXT,
  event_date TIMESTAMP,
  venue_name TEXT,
  ticket_url TEXT NOT NULL,
  estimated_price INTEGER,
  quantity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS api_performance_logs (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_ticket_clicks_referrer ON affiliate_ticket_clicks(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_performance_endpoint ON api_performance_logs(endpoint, created_at);
