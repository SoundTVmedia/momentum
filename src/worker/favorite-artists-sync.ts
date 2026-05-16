import { mochaUserIdKey } from './mocha-user-id';

export { mochaUserIdKey };

export async function getOrCreateArtistIdByName(db: D1Database, displayName: string): Promise<number> {
  const name = displayName.trim();
  if (!name) {
    throw new Error('empty artist name');
  }

  let row = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(name).first()) as { id: unknown } | null;
  let id = row?.id != null ? Number(row.id) : NaN;
  if (Number.isFinite(id) && id > 0) {
    return id;
  }

  try {
    await db
      .prepare(
        'INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      )
      .bind(name)
      .run();

    row = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(name).first()) as { id: unknown } | null;
    id = row?.id != null ? Number(row.id) : NaN;
    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  } catch {
    /* UNIQUE(name) race — re-select below */
  }

  row = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(name).first()) as { id: unknown } | null;
  id = row?.id != null ? Number(row.id) : NaN;
  if (Number.isFinite(id) && id > 0) {
    return id;
  }

  throw new Error('Could not resolve artist id');
}

/** Ensure `user_favorite_artists` rows exist for each display name. */
export async function syncUserFavoriteArtistRows(
  db: D1Database,
  uid: string,
  names: string[],
): Promise<void> {
  const normalized = [...new Set(names.map((n) => String(n ?? '').trim()).filter(Boolean))].slice(0, 25);
  for (const name of normalized) {
    const artistId = await getOrCreateArtistIdByName(db, name);
    const existing = await db
      .prepare('SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?')
      .bind(uid, artistId)
      .first();
    if (!existing) {
      await db
        .prepare(
          'INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        )
        .bind(uid, artistId)
        .run();
    }
  }
}

/**
 * Merge artist names into `user_profiles.favorite_artists` JSON (creates profile row if missing).
 */
export async function mergeProfileFavoriteArtistsJson(
  db: D1Database,
  uid: string,
  names: string[],
): Promise<void> {
  const normalized = [...new Set(names.map((n) => String(n ?? '').trim()).filter(Boolean))].slice(0, 40);
  if (normalized.length === 0) return;

  const profile = (await db
    .prepare('SELECT id, favorite_artists FROM user_profiles WHERE mocha_user_id = ?')
    .bind(uid)
    .first()) as { id: unknown; favorite_artists: string | null } | null;

  let mergedNames: string[] = [...normalized];
  if (profile?.favorite_artists) {
    try {
      const parsed = JSON.parse(profile.favorite_artists) as unknown;
      if (Array.isArray(parsed)) {
        mergedNames = [...new Set([...parsed.map((x) => String(x)), ...normalized])];
      }
    } catch {
      /* keep normalized only */
    }
  }

  const favoritesJson = JSON.stringify(mergedNames);

  await db
    .prepare(
      `INSERT INTO user_profiles (mocha_user_id, role, favorite_artists, created_at, updated_at)
       VALUES (?, 'fan', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(mocha_user_id) DO UPDATE SET
         favorite_artists = excluded.favorite_artists,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(uid, favoritesJson)
    .run();
}
