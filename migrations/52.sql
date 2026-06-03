-- Backfill show_id from JamBase event ids (composite slugs handled by worker backfill).
UPDATE clips
SET show_id = TRIM(jambase_event_id)
WHERE show_id IS NULL
  AND jambase_event_id IS NOT NULL
  AND TRIM(jambase_event_id) != '';
