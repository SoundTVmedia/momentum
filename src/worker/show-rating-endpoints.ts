import type { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';
import { parseStarRating } from '../shared/star-rating';

export type ShowRatingPayload = {
  averageRating: number;
  ratingCount: number;
  userRating: number | null;
  canRate: boolean;
};

function emptyPayload(canRate = false): ShowRatingPayload {
  return { averageRating: 0, ratingCount: 0, userRating: null, canRate };
}

export function normalizeShowRatingId(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

async function loadShowRatingStats(
  db: D1Database,
  showId: string,
): Promise<{ averageRating: number; ratingCount: number }> {
  const stats = (await db
    .prepare(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM show_ratings WHERE show_id = ?',
    )
    .bind(showId)
    .first()) as { avg_rating: number | null; rating_count: number | null } | null;
  return {
    averageRating: Number(stats?.avg_rating) || 0,
    ratingCount: Number(stats?.rating_count) || 0,
  };
}

async function loadUserShowRating(
  db: D1Database,
  showId: string,
  uid: string,
): Promise<number | null> {
  const row = (await db
    .prepare('SELECT rating FROM show_ratings WHERE show_id = ? AND mocha_user_id = ?')
    .bind(showId, uid)
    .first()) as { rating: number } | null;
  return parseStarRating(row?.rating);
}

async function userAttendedShow(db: D1Database, showId: string, uid: string): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok FROM user_show_marks
       WHERE mocha_user_id = ? AND jambase_event_id = ? AND status = 'attended'
       LIMIT 1`,
    )
    .bind(uid, showId)
    .first()) as { ok?: number } | null;
  return Boolean(row);
}

async function buildPayload(
  db: D1Database,
  showId: string,
  uid: string | null,
): Promise<ShowRatingPayload> {
  const stats = await loadShowRatingStats(db, showId);
  if (!uid) return { ...stats, userRating: null, canRate: false };
  const [userRating, canRate] = await Promise.all([
    loadUserShowRating(db, showId, uid),
    userAttendedShow(db, showId, uid),
  ]);
  return { ...stats, userRating, canRate };
}

/** GET /api/shows/:showId/rating — community average plus the viewer’s rating. */
export async function getShowRating(c: Context) {
  const showId = normalizeShowRatingId(c.req.param('showId'));
  if (!showId) return c.json(emptyPayload(), 400);

  const mochaUser = c.get('user') as { id?: unknown } | null | undefined;
  const uid = mochaUser?.id != null ? mochaUserIdKey({ id: mochaUser.id }) : '';

  try {
    const payload = await buildPayload(c.env.DB, showId, uid || null);
    return c.json(payload);
  } catch (error) {
    console.error('Get show rating error:', error);
    return c.json(emptyPayload(), 500);
  }
}

/** POST /api/shows/:showId/rate — 1–5 stars; requires I went. */
export async function rateShow(c: Context) {
  const mochaUser = c.get('user') as { id?: unknown } | null | undefined;
  if (!mochaUser) return c.json({ error: 'Unauthorized' }, 401);

  const showId = normalizeShowRatingId(c.req.param('showId'));
  if (!showId) return c.json({ error: 'Show id is required' }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Rating must be between 1 and 5' }, 400);
  }
  const rating = parseStarRating(
    body && typeof body === 'object' ? (body as { rating?: unknown }).rating : undefined,
  );
  if (rating == null) {
    return c.json({ error: 'Rating must be between 1 and 5' }, 400);
  }

  const uid = mochaUserIdKey({ id: mochaUser.id });
  if (!uid) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const attended = await userAttendedShow(c.env.DB, showId, uid);
    if (!attended) {
      return c.json({ error: 'Mark I went to rate this show.' }, 403);
    }

    await c.env.DB.prepare(
      `INSERT INTO show_ratings (show_id, mocha_user_id, rating, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(show_id, mocha_user_id) DO UPDATE SET
         rating = excluded.rating,
         updated_at = datetime('now')`,
    )
      .bind(showId, uid, rating)
      .run();

    const payload = await buildPayload(c.env.DB, showId, uid);
    return c.json({ success: true, ...payload });
  } catch (error) {
    console.error('Rate show error:', error);
    return c.json({ error: 'Failed to rate show' }, 500);
  }
}
