-- Optional genre metadata for clips and genre hub pages
ALTER TABLE clips ADD COLUMN genre_name TEXT;
ALTER TABLE clips ADD COLUMN genre_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_clips_genre_slug
ON clips(genre_slug)
WHERE genre_slug IS NOT NULL AND TRIM(genre_slug) != '';
