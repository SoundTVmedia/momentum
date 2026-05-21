import { mochaUserIdKey } from './mocha-user-id';

export { mochaUserIdKey };

/** JamBase-style display name: trim, collapse spaces, Unicode NFC (matches clip / feed matching better). */
export function normalizeArtistDisplayName(raw: string): string {
  let s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  try {
    s = s.normalize('NFC');
  } catch {
    /* ignore */
  }
  return s;
}

function rowIdToNumber(id: unknown): number | null {
  if (id == null) return null;
  if (typeof id === 'bigint') {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  const n = typeof id === 'number' ? id : Number(id);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizedNameKey(name: string): string {
  return normalizeArtistDisplayName(name).toLowerCase();
}

function isSqliteUniqueError(msg: string): boolean {
  return /unique constraint|UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(msg);
}

function pickArtistIdFromNameRows(
  rows: { id?: unknown; name?: unknown }[],
  targetKey: string,
): number | null {
  for (const row of rows) {
    if (normalizedNameKey(String(row.name ?? '')) === targetKey) {
      const id = rowIdToNumber(row.id);
      if (id != null) return id;
    }
  }
  return null;
}

async function firstArtistId(
  db: D1Database,
  sql: string,
  ...args: unknown[]
): Promise<number | null> {
  const row = (await db.prepare(sql).bind(...args).first()) as { id?: unknown } | null;
  return rowIdToNumber(row?.id);
}

/** Find an existing row by exact name, case fold, or slug (no silent SQL swallowing). */
async function findArtistIdForName(db: D1Database, displayName: string): Promise<number | null> {
  const key = normalizeArtistDisplayName(displayName);
  if (!key) return null;

  const exact = await firstArtistId(db, 'SELECT id FROM artists WHERE name = ? LIMIT 1', key);
  if (exact != null) return exact;

  const folded = await firstArtistId(
    db,
    `SELECT id FROM artists
     WHERE lower(trim(name)) = lower(trim(?))
     ORDER BY id ASC
     LIMIT 1`,
    key,
  );
  if (folded != null) return folded;

  const nocase = await firstArtistId(
    db,
    'SELECT id FROM artists WHERE name COLLATE NOCASE = ? ORDER BY id ASC LIMIT 1',
    key,
  );
  if (nocase != null) return nocase;

  const lower = await firstArtistId(
    db,
    'SELECT id FROM artists WHERE lower(name) = ? ORDER BY id ASC LIMIT 1',
    key.toLowerCase(),
  );
  if (lower != null) return lower;

  const slug = key.toLowerCase().replace(/\s+/g, '-').trim();
  const bySlug = await firstArtistId(
    db,
    `SELECT id FROM artists
     WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ?
     ORDER BY id ASC
     LIMIT 1`,
    slug,
  );
  if (bySlug != null) return bySlug;

  const targetKey = normalizedNameKey(key);
  const tokens = targetKey.split(/\s+/).filter(Boolean);
  const needle = tokens.length > 0 ? tokens[tokens.length - 1]! : targetKey;
  if (needle.length >= 2) {
    const res = await db
      .prepare(
        `SELECT id, name FROM artists
         WHERE lower(name) LIKE '%' || ? || '%'
         ORDER BY length(name) ASC
         LIMIT 30`,
      )
      .bind(needle)
      .all();
    const fromScan = pickArtistIdFromNameRows(
      (res.results || []) as { id?: unknown; name?: unknown }[],
      targetKey,
    );
    if (fromScan != null) return fromScan;
  }

  return null;
}

/**
 * Resolve an existing `artists.id` for a display name (all strategies).
 */
export async function resolveArtistIdForFavoriteName(
  db: D1Database,
  displayName: string,
): Promise<number | null> {
  return findArtistIdForName(db, displayName);
}

function d1RowChanges(run: { meta?: { changes?: number } }): number {
  const n = run.meta?.changes;
  return typeof n === 'number' && n > 0 ? n : 0;
}

/** Insert or return existing artist row id (no throwing INSERT — D1-safe). */
export async function getOrCreateArtistIdByName(db: D1Database, displayName: string): Promise<number> {
  const name = normalizeArtistDisplayName(displayName);
  if (!name) {
    throw new Error('empty artist name');
  }

  let id = await findArtistIdForName(db, name);
  if (id != null) return id;

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO artists (name, created_at, updated_at)
         VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(name)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSqliteUniqueError(msg)) {
      throw new Error(`Artist insert failed (${JSON.stringify(name)}): ${msg}`);
    }
  }

  id = await findArtistIdForName(db, name);
  if (id != null) return id;

  throw new Error(`Could not resolve artist id for ${JSON.stringify(name)}`);
}

export async function isFavoriteArtistLinked(
  db: D1Database,
  uid: string,
  name: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT ufa.id
       FROM user_favorite_artists ufa
       INNER JOIN artists a ON a.id = ufa.artist_id
       WHERE ufa.mocha_user_id = ?
         AND lower(trim(a.name)) = lower(trim(?))
       LIMIT 1`,
    )
    .bind(uid, name)
    .first();
  return row != null;
}

/**
 * Link `user_favorite_artists` by display name using INSERT…SELECT (avoids resolve-then-insert races).
 */
export async function linkFavoriteArtistByName(
  db: D1Database,
  uid: string,
  displayName: string,
): Promise<void> {
  const name = normalizeArtistDisplayName(displayName);
  if (!name) {
    throw new Error('empty artist name');
  }

  if (await isFavoriteArtistLinked(db, uid, name)) {
    return;
  }

  const linkSql = `INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at)
    SELECT ?, a.id, CURRENT_TIMESTAMP
    FROM artists a
    WHERE lower(trim(a.name)) = lower(trim(?)) OR a.name = ?
    ORDER BY a.id ASC
    LIMIT 1`;

  if (d1RowChanges(await db.prepare(linkSql).bind(uid, name, name).run()) > 0) {
    return;
  }

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO artists (name, created_at, updated_at)
         VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(name)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSqliteUniqueError(msg)) {
      throw new Error(`Artist insert failed (${JSON.stringify(name)}): ${msg}`);
    }
  }

  if (d1RowChanges(await db.prepare(linkSql).bind(uid, name, name).run()) > 0) {
    return;
  }

  const artistId = await findArtistIdForName(db, name);
  if (artistId != null) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO user_favorite_artists (mocha_user_id, artist_id, created_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(uid, artistId)
      .run();
    if (await isFavoriteArtistLinked(db, uid, name)) {
      return;
    }
  }

  throw new Error(`Could not link favorite artist ${JSON.stringify(name)}`);
}

/** Remove `user_favorite_artists` rows for every artist row matching this display name. */
export async function unlinkFavoriteArtistByName(
  db: D1Database,
  uid: string,
  displayName: string,
): Promise<boolean> {
  const name = normalizeArtistDisplayName(displayName);
  if (!name) return false;

  const run = await db
    .prepare(
      `DELETE FROM user_favorite_artists
       WHERE mocha_user_id = ?
         AND artist_id IN (
           SELECT id FROM artists
           WHERE lower(trim(name)) = lower(trim(?)) OR name = ?
         )`,
    )
    .bind(uid, name, name)
    .run();

  return d1RowChanges(run) > 0;
}

export type SyncFavoriteArtistsResult = {
  synced: string[];
  failed: { name: string; error: string }[];
};

/** Ensure `user_favorite_artists` rows exist for each display name. */
export async function syncUserFavoriteArtistRows(
  db: D1Database,
  uid: string,
  names: string[],
): Promise<SyncFavoriteArtistsResult> {
  const normalized = [
    ...new Set(names.map((n) => normalizeArtistDisplayName(String(n ?? ''))).filter(Boolean)),
  ].slice(0, 25);

  const synced: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const name of normalized) {
    try {
      await linkFavoriteArtistByName(db, uid, name);
      synced.push(name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ name, error: msg });
    }
  }

  return { synced, failed };
}

/**
 * Overwrite `user_profiles.favorite_artists` JSON with canonical `artists.name` values
 * for every `user_favorite_artists` row (same source as “Your Artists” on the home feed).
 */
export async function replaceProfileFavoriteArtistsJsonFromTable(db: D1Database, uid: string): Promise<void> {
  const res = await db
    .prepare(
      `SELECT artists.name AS name
       FROM user_favorite_artists
       INNER JOIN artists ON artists.id = user_favorite_artists.artist_id
       WHERE user_favorite_artists.mocha_user_id = ?
       ORDER BY user_favorite_artists.created_at ASC`,
    )
    .bind(uid)
    .all();

  const names = (res.results || [])
    .map((r) => String((r as { name?: unknown }).name ?? '').trim())
    .filter(Boolean);

  const favoritesJson = JSON.stringify(names);

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

/**
 * Merge canonical `artists.name` values for rows matching this batch into profile JSON
 * (additive sync-by-name — does not remove unrelated profile entries).
 */
export async function mergeCanonicalNamesForFavoriteBatch(
  db: D1Database,
  uid: string,
  requestedNames: string[],
): Promise<void> {
  const keys = [...new Set(requestedNames.map((n) => normalizeArtistDisplayName(n)).filter(Boolean))];
  if (keys.length === 0) return;
  const lowered = keys.map((k) => k.toLowerCase());
  const ph = lowered.map(() => '?').join(',');
  const res = await db
    .prepare(
      `SELECT DISTINCT artists.name AS name
       FROM user_favorite_artists
       INNER JOIN artists ON artists.id = user_favorite_artists.artist_id
       WHERE user_favorite_artists.mocha_user_id = ?
         AND lower(trim(artists.name)) IN (${ph})`,
    )
    .bind(uid, ...lowered)
    .all();
  const canonical = (res.results || [])
    .map((r) => String((r as { name?: unknown }).name ?? '').trim())
    .filter(Boolean);
  const toMerge = canonical.length > 0 ? canonical : keys;
  await mergeProfileFavoriteArtistsJson(db, uid, toMerge);
}

/**
 * Merge artist names into `user_profiles.favorite_artists` JSON (creates profile row if missing).
 */
export async function mergeProfileFavoriteArtistsJson(
  db: D1Database,
  uid: string,
  names: string[],
): Promise<void> {
  const normalized = [
    ...new Set(names.map((n) => normalizeArtistDisplayName(String(n ?? ''))).filter(Boolean)),
  ].slice(0, 40);
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
        mergedNames = [
          ...new Set([
            ...parsed.map((x) => normalizeArtistDisplayName(String(x))),
            ...normalized,
          ]),
        ];
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

function parseProfileFavoriteArtistNamesJson(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => normalizeArtistDisplayName(typeof x === 'string' ? x : String(x ?? '')))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Canonical favorite artist display names from `user_favorite_artists` and profile JSON.
 */
export async function loadCanonicalFavoriteArtistNames(
  db: D1Database,
  uid: string,
  maxNames = 40,
): Promise<string[]> {
  const favorites = await db
    .prepare(
      `SELECT artists.name AS name
       FROM user_favorite_artists
       LEFT JOIN artists ON artists.id = user_favorite_artists.artist_id
       WHERE user_favorite_artists.mocha_user_id = ?`,
    )
    .bind(uid)
    .all();

  const names = new Set<string>();
  for (const row of favorites.results || []) {
    const n = normalizeArtistDisplayName(String((row as { name?: unknown }).name ?? ''));
    if (n) names.add(n);
  }

  const profileRow = (await db
    .prepare('SELECT favorite_artists FROM user_profiles WHERE mocha_user_id = ?')
    .bind(uid)
    .first()) as { favorite_artists: string | null } | null;

  for (const n of parseProfileFavoriteArtistNamesJson(profileRow?.favorite_artists ?? null)) {
    names.add(n);
  }

  return [...names].slice(0, maxNames);
}

/**
 * Toggle artist follow → `user_favorite_artists` + profile `favorite_artists` JSON.
 */
export async function toggleArtistFollowFavorite(
  db: D1Database,
  uid: string,
  targetArtistId: number,
  rawArtistName: string,
): Promise<{ following: boolean; artist_id: number }> {
  const name = normalizeArtistDisplayName(rawArtistName);
  let artistId = targetArtistId;

  if (name) {
    artistId = await getOrCreateArtistIdByName(db, name);
  } else if (!Number.isInteger(artistId) || artistId <= 0) {
    throw new Error('Invalid artist');
  }

  const rowById = await db
    .prepare('SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?')
    .bind(uid, artistId)
    .first();

  const linkedByName = name ? await isFavoriteArtistLinked(db, uid, name) : false;

  if (rowById || linkedByName) {
    await db
      .prepare('DELETE FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?')
      .bind(uid, artistId)
      .run();
    if (name) {
      await unlinkFavoriteArtistByName(db, uid, name);
    }
    await replaceProfileFavoriteArtistsJsonFromTable(db, uid);
    const resolvedId = name
      ? (await resolveArtistIdForFavoriteName(db, name)) ?? artistId
      : artistId;
    return { following: false, artist_id: resolvedId };
  }

  if (name) {
    await linkFavoriteArtistByName(db, uid, name);
  } else {
    await db
      .prepare(
        `INSERT OR IGNORE INTO user_favorite_artists (mocha_user_id, artist_id, created_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(uid, artistId)
      .run();
  }

  await replaceProfileFavoriteArtistsJsonFromTable(db, uid);
  if (name) {
    await mergeProfileFavoriteArtistsJson(db, uid, [name]);
  }

  const resolvedId = name
    ? (await resolveArtistIdForFavoriteName(db, name)) ?? artistId
    : artistId;
  return { following: true, artist_id: resolvedId };
}
