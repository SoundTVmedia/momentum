import type { Context } from 'hono';
import type { MochaUser } from '@/shared/mocha-user';
import { genreSlugFromName } from '../shared/genre-tag';
import { normalizeClipApiRows } from './clip-row-normalize';
import type { DiscoverLocation } from './discover-location';
import { loadCanonicalFavoriteArtistNames, mochaUserIdKey } from './favorite-artists-sync';

const FOR_YOU_LIMIT = 12;
const NEARBY_RADIUS_MILES = 50;

export type DiscoverForYouPayload = {
  clips: ReturnType<typeof normalizeClipApiRows>;
  personalized: boolean;
  subtitle: string;
};

function parseProfileGenresJson(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function venueNamesFromJamBaseEvents(events: Record<string, unknown>[]): string[] {
  const names = new Set<string>();
  for (const ev of events) {
    const loc = ev.location;
    if (!loc || typeof loc !== 'object') continue;
    const n = (loc as Record<string, unknown>).name;
    if (typeof n === 'string' && n.trim()) names.add(n.trim());
  }
  return [...names].slice(0, 24);
}

async function loadFollowedVenueNames(db: D1Database, uid: string): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT following_id FROM follows
       WHERE follower_id = ? AND following_id LIKE 'venue-%'`,
    )
    .bind(uid)
    .all();

  const ids: number[] = [];
  for (const row of rows.results || []) {
    const fid = String((row as { following_id?: unknown }).following_id ?? '');
    const m = /^venue-(\d+)$/.exec(fid);
    if (m) {
      const id = Number(m[1]);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }
  }
  if (ids.length === 0) return [];

  const ph = ids.map(() => '?').join(',');
  const venues = await db
    .prepare(`SELECT name FROM venues WHERE id IN (${ph})`)
    .bind(...ids)
    .all();

  return (venues.results || [])
    .map((r) => {
      const n = (r as { name?: unknown }).name;
      return typeof n === 'string' ? n.trim() : '';
    })
    .filter(Boolean);
}

async function loadLikedGenreTokens(db: D1Database, uid: string): Promise<{
  names: string[];
  slugs: string[];
}> {
  const names = new Set<string>();
  const slugs = new Set<string>();

  const profile = await db
    .prepare('SELECT genres FROM user_profiles WHERE mocha_user_id = ?')
    .bind(uid)
    .first<{ genres: string | null }>();

  for (const g of parseProfileGenresJson(profile?.genres ?? null)) {
    names.add(g);
    const slug = genreSlugFromName(g);
    if (slug) slugs.add(slug);
  }

  const liked = await db
    .prepare(
      `SELECT DISTINCT clips.genre_name, clips.genre_slug
       FROM clip_likes
       INNER JOIN clips ON clips.id = clip_likes.clip_id
       WHERE clip_likes.mocha_user_id = ?
       AND clips.is_hidden = 0
       AND clips.genre_slug IS NOT NULL AND TRIM(clips.genre_slug) != ''`,
    )
    .bind(uid)
    .all();

  for (const row of liked.results || []) {
    const r = row as { genre_name?: unknown; genre_slug?: unknown };
    const gn = typeof r.genre_name === 'string' ? r.genre_name.trim() : '';
    const gs = typeof r.genre_slug === 'string' ? r.genre_slug.trim().toLowerCase() : '';
    if (gn) {
      names.add(gn);
      const slug = genreSlugFromName(gn);
      if (slug) slugs.add(slug);
    }
    if (gs) slugs.add(gs);
  }

  return {
    names: [...names].map((n) => n.toLowerCase()),
    slugs: [...slugs],
  };
}

async function fetchLoggedInForYou(
  db: D1Database,
  uid: string,
): Promise<DiscoverForYouPayload | null> {
  const [artistNames, venueNames, genres] = await Promise.all([
    loadCanonicalFavoriteArtistNames(db, uid, 40),
    loadFollowedVenueNames(db, uid),
    loadLikedGenreTokens(db, uid),
  ]);

  const hasArtists = artistNames.length > 0;
  const hasVenues = venueNames.length > 0;
  const hasGenres = genres.names.length > 0 || genres.slugs.length > 0;

  if (!hasArtists && !hasVenues && !hasGenres) {
    return null;
  }

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (hasArtists) {
    const ph = artistNames.map(() => '?').join(',');
    const lowerPh = [...new Set(artistNames.map((n) => n.trim().toLowerCase()))].map(() => '?').join(',');
    conditions.push(
      `(clips.artist_name IN (${ph}) OR LOWER(TRIM(clips.artist_name)) IN (${lowerPh}))`,
    );
    bindings.push(...artistNames, ...[...new Set(artistNames.map((n) => n.trim().toLowerCase()))]);
  }

  if (hasVenues) {
    const ph = venueNames.map(() => '?').join(',');
    const lowerPh = [...new Set(venueNames.map((n) => n.trim().toLowerCase()))].map(() => '?').join(',');
    conditions.push(
      `(clips.venue_name IN (${ph}) OR LOWER(TRIM(clips.venue_name)) IN (${lowerPh}))`,
    );
    bindings.push(...venueNames, ...[...new Set(venueNames.map((n) => n.trim().toLowerCase()))]);
  }

  if (hasGenres) {
    const genreConds: string[] = [];
    if (genres.slugs.length > 0) {
      const ph = genres.slugs.map(() => '?').join(',');
      genreConds.push(`LOWER(TRIM(clips.genre_slug)) IN (${ph})`);
      bindings.push(...genres.slugs);
    }
    if (genres.names.length > 0) {
      const ph = genres.names.map(() => '?').join(',');
      genreConds.push(`LOWER(TRIM(clips.genre_name)) IN (${ph})`);
      bindings.push(...genres.names);
    }
    if (genreConds.length > 0) {
      conditions.push(`(${genreConds.join(' OR ')})`);
    }
  }

  const whereMatch = conditions.join(' OR ');

  const simpleQuery = `
    SELECT
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0 AND clips.is_draft = 0
    AND clips.mocha_user_id != ?
    AND (${whereMatch})
    ORDER BY clips.created_at DESC
    LIMIT ?
  `;

  const res = await db.prepare(simpleQuery).bind(...bindings, uid, FOR_YOU_LIMIT).all();
  const clips = normalizeClipApiRows((res.results || []) as Record<string, unknown>[]);
  if (clips.length === 0) return null;

  return {
    clips,
    personalized: true,
    subtitle: 'Moments from artists and venues you follow, and genres you love',
  };
}

async function fetchGuestForYou(
  db: D1Database,
  location: DiscoverLocation,
  nearbyEvents: Record<string, unknown>[],
): Promise<DiscoverForYouPayload | null> {
  const venueNames = venueNamesFromJamBaseEvents(nearbyEvents);
  const lat = location.latitude;
  const lon = location.longitude;

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  conditions.push(`
    clips.geolocation_latitude IS NOT NULL
    AND clips.geolocation_longitude IS NOT NULL
    AND (
      3959 * acos(
        cos(radians(?)) * cos(radians(clips.geolocation_latitude)) *
        cos(radians(clips.geolocation_longitude) - radians(?)) +
        sin(radians(?)) * sin(radians(clips.geolocation_latitude))
      )
    ) <= ?
  `);
  bindings.push(lat, lon, lat, NEARBY_RADIUS_MILES);

  if (venueNames.length > 0) {
    const ph = venueNames.map(() => '?').join(',');
    const lower = [...new Set(venueNames.map((n) => n.trim().toLowerCase()))];
    const lowerPh = lower.map(() => '?').join(',');
    conditions.push(
      `(clips.venue_name IN (${ph}) OR LOWER(TRIM(clips.venue_name)) IN (${lowerPh}))`,
    );
    bindings.push(...venueNames, ...lower);
  }

  const query = `
    SELECT
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0 AND clips.is_draft = 0
    AND (${conditions.join(' OR ')})
    ORDER BY clips.created_at DESC
    LIMIT ?
  `;

  const res = await db.prepare(query).bind(...bindings, FOR_YOU_LIMIT).all();
  const clips = normalizeClipApiRows((res.results || []) as Record<string, unknown>[]);
  if (clips.length === 0) return null;

  const locLabel = location.label?.trim();
  const subtitle = locLabel
    ? `Moments from venues near ${locLabel}`
    : location.source === 'ip'
      ? 'Moments from venues near you'
      : 'Moments from venues in your area';

  return {
    clips,
    personalized: false,
    subtitle,
  };
}

export async function buildDiscoverForYou(
  c: Context<{ Bindings: Env }>,
  mochaUser: MochaUser | null | undefined,
  location: DiscoverLocation,
  nearbyEvents: Record<string, unknown>[],
): Promise<DiscoverForYouPayload | null> {
  if (mochaUser) {
    const uid = mochaUserIdKey(mochaUser);
    if (!uid) return null;
    return fetchLoggedInForYou(c.env.DB, uid);
  }
  return fetchGuestForYou(c.env.DB, location, nearbyEvents);
}
