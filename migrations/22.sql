
CREATE TABLE affiliate_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_user_id TEXT NOT NULL,
  transaction_id INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  commission_rate REAL NOT NULL,
  event_name TEXT,
  event_date DATETIME,
  ticket_quantity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_affiliate_sales_referrer ON affiliate_sales(referrer_user_id);
CREATE INDEX idx_affiliate_sales_transaction ON affiliate_sales(transaction_id);
