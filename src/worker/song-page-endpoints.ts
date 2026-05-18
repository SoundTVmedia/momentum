import type { Context } from 'hono';
import { normalizeClipApiRows } from './clip-row-normalize';
import { resolveArtistNameForClipsQuery } from './artist-venue-pages';
import { jamBaseQuotaFromEnv } from './jambase-client';
import {
  normalizedSlugFromRouteParam,
  slugifyEntityName,
} from '../shared/jambase-slug';
import { songTitleFromSlug } from '../shared/song-tag';

export async function buildSongPagePayload(c: Context): Promise<Response> {
  const artistParam = c.req.param('artistName') ?? '';
  const songParam = c.req.param('songSlug') ?? '';
  const songSlug = normalizedSlugFromRouteParam(songParam);

  if (!songSlug) {
    return c.json({ error: 'songSlug is required' }, 400);
  }

  const artistName = await resolveArtistNameForClipsQuery(
    c.env.DB,
    c.env.JAMBASE_API_KEY,
    artistParam,
    jamBaseQuotaFromEnv(c.env),
  );

  if (!artistName?.trim()) {
    return c.json({ error: 'Artist not found' }, 404);
  }

  const artistSlug = slugifyEntityName(artistName);
  const clipsRes = await c.env.DB.prepare(
    `SELECT
      clips.rowid AS _clipRowId,
      clips.id AS clip_primary_id,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.is_hidden = 0
    AND clips.is_draft = 0
    AND (
      clips.artist_name = ?
      OR LOWER(REPLACE(TRIM(IFNULL(clips.artist_name, '')), ' ', '-')) = ?
    )
    AND clips.song_slug = ?
    ORDER BY clips.created_at DESC
    LIMIT 80`
  )
    .bind(artistName, artistSlug, songSlug)
    .all();

  const rows = (clipsRes.results ?? []) as Record<string, unknown>[];
  const clips = normalizeClipApiRows(rows);

  let displayTitle = songTitleFromSlug(songSlug);
  for (const row of rows) {
    const st = typeof row.song_title === 'string' ? row.song_title.trim() : '';
    if (st) {
      displayTitle = st;
      break;
    }
  }

  return c.json({
    artist: {
      name: artistName,
      slug: artistSlug,
    },
    song: {
      title: displayTitle,
      slug: songSlug,
    },
    clips,
    clipCount: clips.length,
  });
}
