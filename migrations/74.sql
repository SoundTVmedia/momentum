-- Durable playback health: cron/worker marks clips that cannot be played so public
-- feeds can exclude them, and superadmin review can list them.
ALTER TABLE clips ADD COLUMN playback_unplayable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clips ADD COLUMN playback_unplayable_reason TEXT;
ALTER TABLE clips ADD COLUMN playback_checked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_clips_playback_unplayable
  ON clips(playback_unplayable, updated_at)
  WHERE playback_unplayable = 1;
