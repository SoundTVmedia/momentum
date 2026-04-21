
CREATE TABLE artist_tour_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id INTEGER NOT NULL,
  venue_id INTEGER,
  date DATETIME NOT NULL,
  city TEXT,
  country TEXT,
  ticket_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_artist_tour_dates_artist ON artist_tour_dates(artist_id);
CREATE INDEX idx_artist_tour_dates_date ON artist_tour_dates(date);
