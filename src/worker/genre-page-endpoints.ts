import type { Context } from 'hono';
import { normalizeClipApiRows } from './clip-row-normalize';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  titleCaseWords,
} from '../shared/jambase-slug';
import { genreNameFromSlug } from '../shared/genre-tag';

export async function resolveGenreNameForClipsQuery(
  db: D1Database,
  routeParam: string,
): Promise<string> {
  const slug = normalizedSlugFromRouteParam(routeParam);
  if (!slug) return '';

  const clip = await db
    .prepare(
      `SELECT genre_name FROM clips
       WHERE genre_name IS NOT NULL AND TRIM(genre_name) != ''
       AND genre_slug = ?
       LIMIT 1`,
    )
    .bind(slug)
    .first<{ genre_name: string }>();
  if (clip?.genre_name) return clip.genre_name;

  const distinct = await db
    .prepare(
      `SELECT genre_name FROM clips
       WHERE genre_name IS NOT NULL AND TRIM(genre_name) != ''
       AND LOWER(REPLACE(TRIM(genre_name), ' ', '-')) = ?
       LIMIT 1`,
    )
    .bind(slug)
    .first<{ genre_name: string }>();
  if (distinct?.genre_name) return distinct.genre_name;

  return titleCaseWords(searchPhraseFromSlug(slug)) || genreNameFromSlug(slug);
}

const CLIP_SELECT = `
  SELECT
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
`;

export async function buildGenrePagePayload(c: Context): Promise<Response> {
  const genreParam = c.req.param('genreSlug') ?? '';
  const genreSlug = normalizedSlugFromRouteParam(genreParam);

  if (!genreSlug) {
    return c.json({ error: 'genreSlug is required' }, 400);
  }

  const genreName = await resolveGenreNameForClipsQuery(c.env.DB, genreParam);
  if (!genreName?.trim()) {
    return c.json({ error: 'Genre not found' }, 404);
  }

  const clipsRes = await c.env.DB.prepare(
    `${CLIP_SELECT}
    AND clips.genre_slug = ?
    ORDER BY clips.created_at DESC
    LIMIT 80`,
  )
    .bind(genreSlug)
    .all();

  const rows = (clipsRes.results ?? []) as Record<string, unknown>[];
  const clips = normalizeClipApiRows(rows);

  return c.json({
    genre: {
      name: genreName,
      slug: genreSlug,
    },
    clips,
    clipCount: clips.length,
  });
}
