-- Persist fingerprint credits so we can show an Opener badge and let users
-- force a typed title when it disagrees with ShazamKit / ACRCloud.
ALTER TABLE clips ADD COLUMN recognized_song_title TEXT;
ALTER TABLE clips ADD COLUMN recognized_song_artist TEXT;
ALTER TABLE clips ADD COLUMN song_title_forced INTEGER NOT NULL DEFAULT 0;
