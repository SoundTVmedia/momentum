ALTER TABLE clips ADD COLUMN event_title TEXT;

UPDATE clips
SET event_title = TRIM(artist_name) || ' at ' || TRIM(venue_name)
WHERE event_title IS NULL
  AND artist_name IS NOT NULL AND TRIM(artist_name) != ''
  AND venue_name IS NOT NULL AND TRIM(venue_name) != '';
