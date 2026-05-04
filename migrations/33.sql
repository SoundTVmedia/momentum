-- Add show_id column to clips table to track which show/event a clip is from
ALTER TABLE clips ADD COLUMN show_id TEXT;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_clips_show_id ON clips(show_id);
