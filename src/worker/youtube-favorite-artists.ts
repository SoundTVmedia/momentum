import { normalizeArtistDisplayName } from './favorite-artists-sync';

const MAX_PROFILE_FAVORITE_NAMES = 40;

export type YoutubeFavoriteArtist = {
  artist_id: number | null;
  name: string;
  social_links: string | null;
  youtube_channel_id: string | null;
};

function parseProfileFavoriteArtistNames(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
      .filter(Boolean)
      .slice(0, MAX_PROFILE_FAVORITE_NAMES);
  } catch {
    return [];
  }
}

/**
 * Same sources as `/api/discover/favorite-artist-feed`:
 * `user_favorite_artists` plus `user_profiles.favorite_artists` JSON.
 */
export async function loadFavoriteArtistsForYoutube(
  db: D1Database,
  uid: string,
  maxArtists: number,
): Promise<YoutubeFavoriteArtist[]> {
  const favorites = await db
    .prepare(
      `SELECT
        user_favorite_artists.artist_id,
        artists.name,
        artists.social_links,
        artists.youtube_channel_id
      FROM user_favorite_artists
      LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
      WHERE user_favorite_artists.mocha_user_id = ?`,
    )
    .bind(uid)
    .all();

  const rows = (favorites.results ?? []) as {
    artist_id?: unknown;
    name?: unknown;
    social_links?: unknown;
    youtube_channel_id?: unknown;
  }[];

  const profileRow = (await db
    .prepare(`SELECT favorite_artists FROM user_profiles WHERE mocha_user_id = ?`)
    .bind(uid)
    .first()) as { favorite_artists: string | null } | null;

  const profileNames = parseProfileFavoriteArtistNames(profileRow?.favorite_artists ?? null);

  const byKey = new Map<string, YoutubeFavoriteArtist>();

  const add = (entry: YoutubeFavoriteArtist) => {
    const key = normalizeArtistDisplayName(entry.name).toLowerCase();
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      return;
    }
    if (!existing.artist_id && entry.artist_id) byKey.set(key, entry);
    if (!existing.youtube_channel_id && entry.youtube_channel_id) {
      byKey.set(key, { ...existing, youtube_channel_id: entry.youtube_channel_id });
    }
    if (!existing.social_links && entry.social_links) {
      byKey.set(key, { ...byKey.get(key)!, social_links: entry.social_links });
    }
  };

  for (const r of rows) {
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    const artistId =
      typeof r.artist_id === 'number'
        ? r.artist_id
        : Number.isFinite(Number(r.artist_id))
          ? Number(r.artist_id)
          : null;
    add({
      artist_id: artistId && artistId > 0 ? artistId : null,
      name,
      social_links: typeof r.social_links === 'string' ? r.social_links : null,
      youtube_channel_id:
        typeof r.youtube_channel_id === 'string' && r.youtube_channel_id.trim()
          ? r.youtube_channel_id.trim()
          : null,
    });
  }

  const unmatchedProfileNames: string[] = [];
  for (const profileName of profileNames) {
    const key = normalizeArtistDisplayName(profileName).toLowerCase();
    if (!key || byKey.has(key)) continue;
    unmatchedProfileNames.push(profileName);
  }

  if (unmatchedProfileNames.length > 0) {
    const lowered = [...new Set(unmatchedProfileNames.map((s) => s.toLowerCase()))];
    const ph = lowered.map(() => '?').join(',');
    const matched = await db
      .prepare(
        `SELECT id, name, social_links, youtube_channel_id FROM artists WHERE LOWER(TRIM(name)) IN (${ph})`,
      )
      .bind(...lowered)
      .all();

    for (const m of (matched.results ?? []) as {
      id?: unknown;
      name?: unknown;
      social_links?: unknown;
      youtube_channel_id?: unknown;
    }[]) {
      const name = typeof m.name === 'string' ? m.name.trim() : '';
      if (!name) continue;
      const artistId = typeof m.id === 'number' ? m.id : Number(m.id);
      add({
        artist_id: Number.isFinite(artistId) && artistId > 0 ? artistId : null,
        name,
        social_links: typeof m.social_links === 'string' ? m.social_links : null,
        youtube_channel_id:
          typeof m.youtube_channel_id === 'string' && m.youtube_channel_id.trim()
            ? m.youtube_channel_id.trim()
            : null,
      });
    }

    for (const profileName of unmatchedProfileNames) {
      const key = normalizeArtistDisplayName(profileName).toLowerCase();
      if (!key || byKey.has(key)) continue;
      add({
        artist_id: null,
        name: profileName,
        social_links: null,
        youtube_channel_id: null,
      });
    }
  }

  return [...byKey.values()]
    .filter((a) => a.name.trim().length > 0)
    .slice(0, maxArtists);
}
