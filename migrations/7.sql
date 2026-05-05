
CREATE TABLE artists (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  bio TEXT,
  image_url TEXT,
  social_links TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_artists_name ON artists(name);
