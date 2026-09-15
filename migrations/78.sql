-- Persist extracted JamBase setlists on the event cache so show pages
-- do not need an upstream call on every visit.
ALTER TABLE jambase_events ADD COLUMN setlist_json TEXT;
