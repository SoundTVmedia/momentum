import { mochaUserIdKey, parseD1LastRowId } from './mocha-user-id';

export { mochaUserIdKey };

function rowIdToNumber(id: unknown): number | null {
  if (id == null) return null;
  if (typeof id === 'bigint') {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  const n = typeof id === 'number' ? id : Number(id);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Exact match, then case-insensitive (SQLite default UNIQUE on `name` is exact-only). */
async function findArtistIdByName(db: D1Database, name: string): Promise<number | null> {
  const exact = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(name).first()) as {
    id: unknown;
  } | null;
  const eid = rowIdToNumber(exact?.id);
  if (eid != null) return eid;

  const fold = (await db
    .prepare('SELECT id FROM artists WHERE lower(name) = lower(?) LIMIT 1')
    .bind(name)
    .first()) as { id: unknown } | null;
  return rowIdToNumber(fold?.id);
}

export async function getOrCreateArtistIdByName(db: D1Database, displayName: string): Promise<number> {
  const name = displayName.trim();
  if (!name) {
    throw new Error('empty artist name');
  }

  const existing = await findArtistIdByName(db, name);
  if (existing != null) return existing;

  try {
    const ins = await db
      .prepare(
        'INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      )
      .bind(name)
      .run();

    const insAny = ins as { success?: boolean; error?: string; meta?: { last_row_id?: unknown } };
    if (insAny.success === false) {
      const afterFail = await findArtistIdByName(db, name);
      if (afterFail != null) return afterFail;
      throw new Error(
        `Artist insert failed (${JSON.stringify(name)}): ${insAny.error ?? 'D1 returned success: false'}`,
      );
    }

    const fromMeta = parseD1LastRowId(insAny.meta?.last_row_id);
    if (fromMeta != null) return fromMeta;

    const afterInsert = await findArtistIdByName(db, name);
    if (afterInsert != null) return afterInsert;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUniqueRace = /unique|constraint/i.test(msg);
    const afterRace = await findArtistIdByName(db, name);
    if (afterRace != null) return afterRace;
    if (!isUniqueRace) {
      throw new Error(`Artist insert failed (${JSON.stringify(name)}): ${msg}`);
    }
  }

  const last = await findArtistIdByName(db, name);
  if (last != null) return last;

  throw new Error(`Could not resolve artist id for ${JSON.stringify(name)}`);
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
