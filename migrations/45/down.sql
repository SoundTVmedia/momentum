DROP INDEX IF EXISTS idx_venues_jambase_id_unique;
ALTER TABLE venues DROP COLUMN jambase_id;
