-- Enforce canonical clip IDs in SQLite/D1:
-- - `clips.id` must be INTEGER PRIMARY KEY (rowid alias, non-null)
-- - Existing rows with null/non-numeric IDs are backfilled deterministically

PRAGMA foreign_keys = OFF;

CREATE TABLE clips_new (
  id INTEGER PRIMARY KEY NOT NULL,
  mocha_user_id TEXT NOT NULL,
  artist_name TEXT,
  venue_name TEXT,
  location TEXT,
  timestamp TIMESTAMP,
  content_description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  hashtags TEXT,
  is_trending_score REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_hidden BOOLEAN DEFAULT false,
  stream_video_id TEXT,
  stream_playback_url TEXT,
  stream_thumbnail_url TEXT,
  video_status TEXT DEFAULT 'ready',
  video_duration INTEGER,
  average_rating REAL DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  show_id TEXT,
  status TEXT DEFAULT 'published',
  geolocation_latitude REAL,
  geolocation_longitude REAL,
  geolocation_accuracy_radius REAL,
  is_draft BOOLEAN DEFAULT false,
  recording_orientation TEXT,
  video_resolution_w INTEGER,
  video_resolution_h INTEGER
);

WITH normalized AS (
  SELECT
    rowid AS src_rowid,
    CASE
      WHEN typeof(id) = 'integer' AND id > 0 THEN CAST(id AS INTEGER)
      WHEN typeof(id) = 'text' AND TRIM(id) GLOB '[0-9]*' AND CAST(TRIM(id) AS INTEGER) > 0
        THEN CAST(TRIM(id) AS INTEGER)
      ELSE NULL
    END AS parsed_id,
    mocha_user_id,
    artist_name,
    venue_name,
    location,
    timestamp,
    content_description,
    video_url,
    thumbnail_url,
    likes_count,
    comments_count,
    views_count,
    hashtags,
    is_trending_score,
    created_at,
    updated_at,
    is_hidden,
    stream_video_id,
    stream_playback_url,
    stream_thumbnail_url,
    video_status,
    video_duration,
    average_rating,
    rating_count,
    show_id,
    status,
    geolocation_latitude,
    geolocation_longitude,
    geolocation_accuracy_radius,
    is_draft,
    recording_orientation,
    video_resolution_w,
    video_resolution_h
  FROM clips
),
max_existing AS (
  SELECT COALESCE(MAX(parsed_id), 0) AS max_id
  FROM normalized
),
null_id_rows AS (
  SELECT
    src_rowid,
    ROW_NUMBER() OVER (ORDER BY src_rowid) AS rn
  FROM normalized
  WHERE parsed_id IS NULL
)
INSERT INTO clips_new (
  id,
  mocha_user_id,
  artist_name,
  venue_name,
  location,
  timestamp,
  content_description,
  video_url,
  thumbnail_url,
  likes_count,
  comments_count,
  views_count,
  hashtags,
  is_trending_score,
  created_at,
  updated_at,
  is_hidden,
  stream_video_id,
  stream_playback_url,
  stream_thumbnail_url,
  video_status,
  video_duration,
  average_rating,
  rating_count,
  show_id,
  status,
  geolocation_latitude,
  geolocation_longitude,
  geolocation_accuracy_radius,
  is_draft,
  recording_orientation,
  video_resolution_w,
  video_resolution_h
)
SELECT
  COALESCE(
    n.parsed_id,
    (SELECT max_id FROM max_existing) + (
      SELECT rn FROM null_id_rows r WHERE r.src_rowid = n.src_rowid
    )
  ) AS id,
  n.mocha_user_id,
  n.artist_name,
  n.venue_name,
  n.location,
  n.timestamp,
  n.content_description,
  COALESCE(n.video_url, n.stream_playback_url, '') AS video_url,
  n.thumbnail_url,
  n.likes_count,
  n.comments_count,
  n.views_count,
  n.hashtags,
  n.is_trending_score,
  n.created_at,
  n.updated_at,
  n.is_hidden,
  n.stream_video_id,
  n.stream_playback_url,
  n.stream_thumbnail_url,
  n.video_status,
  n.video_duration,
  n.average_rating,
  n.rating_count,
  n.show_id,
  n.status,
  n.geolocation_latitude,
  n.geolocation_longitude,
  n.geolocation_accuracy_radius,
  n.is_draft,
  n.recording_orientation,
  n.video_resolution_w,
  n.video_resolution_h
FROM normalized n
ORDER BY n.src_rowid;

DROP TABLE clips;
ALTER TABLE clips_new RENAME TO clips;

CREATE INDEX IF NOT EXISTS idx_clips_mocha_user_id ON clips(mocha_user_id);
CREATE INDEX IF NOT EXISTS idx_clips_artist_name ON clips(artist_name);
CREATE INDEX IF NOT EXISTS idx_clips_venue_name ON clips(venue_name);
CREATE INDEX IF NOT EXISTS idx_clips_trending_score ON clips(is_trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_hidden ON clips(is_hidden);
CREATE INDEX IF NOT EXISTS idx_clips_video_status ON clips(video_status);
CREATE INDEX IF NOT EXISTS idx_clips_show_id ON clips(show_id);
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON clips(mocha_user_id);
CREATE INDEX IF NOT EXISTS idx_clips_trending ON clips(is_trending_score DESC, created_at DESC);

PRAGMA foreign_keys = ON;
