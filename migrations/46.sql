-- AudD / user-provided song metadata for clips and per-song hub pages
ALTER TABLE clips ADD COLUMN song_title TEXT;
ALTER TABLE clips ADD COLUMN song_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_clips_artist_song_slug
ON clips(artist_name, song_slug)
WHERE song_slug IS NOT NULL AND TRIM(song_slug) != '';
