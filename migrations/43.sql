-- Optional JamBase linkage for clips (auto-tag from show resolver)
ALTER TABLE clips ADD COLUMN jambase_event_id TEXT;
ALTER TABLE clips ADD COLUMN jambase_artist_id TEXT;
ALTER TABLE clips ADD COLUMN jambase_venue_id TEXT;
