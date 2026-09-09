-- Per-clip playback samples from the client player (TTFF, stalls, duration).
CREATE TABLE IF NOT EXISTS clip_playback_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id INTEGER NOT NULL,
  ttff_ms INTEGER NOT NULL,
  stall_count INTEGER NOT NULL DEFAULT 0,
  rebuffer_ms INTEGER NOT NULL DEFAULT 0,
  playback_url TEXT NOT NULL DEFAULT '',
  rendition TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clip_playback_telemetry_created
  ON clip_playback_telemetry(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clip_playback_telemetry_ttff
  ON clip_playback_telemetry(ttff_ms DESC);
