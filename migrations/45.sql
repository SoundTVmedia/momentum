-- JamBase venue id for stable /events lookups and venue page payloads
ALTER TABLE venues ADD COLUMN jambase_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_jambase_id_unique
ON venues(jambase_id)
WHERE jambase_id IS NOT NULL AND LENGTH(TRIM(jambase_id)) > 0;
