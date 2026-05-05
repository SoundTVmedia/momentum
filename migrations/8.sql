
CREATE TABLE venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  address TEXT,
  image_url TEXT,
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_venues_name ON venues(name);
