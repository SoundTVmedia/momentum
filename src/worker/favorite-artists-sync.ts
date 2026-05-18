import { mochaUserIdKey, parseD1LastRowId } from './mocha-user-id';

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

/**
 * Insert or return existing artist row id. Uses SQLite upsert so UNIQUE on `name` always yields an id.
 */
export async function getOrCreateArtistIdByName(db: D1Database, displayName: string): Promise<number> {
  const name = normalizeArtistDisplayName(displayName);
  if (!name) {
    throw new Error('empty artist name');
  }

  const existing = await findArtistIdForName(db, name);
  if (existing != null) return existing;

  try {
    const upserted = (await db
      .prepare(
        `INSERT INTO artists (name, created_at, updated_at)
         VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
      )
      .bind(name)
      .first()) as { id?: unknown } | null;

    const fromUpsert = rowIdToNumber(upserted?.id);
    if (fromUpsert != null) return fromUpsert;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSqliteUniqueError(msg)) {
      throw new Error(`Artist insert failed (${JSON.stringify(name)}): ${msg}`);
    }
  }

  const afterConflict = await findArtistIdForName(db, name);
  if (afterConflict != null) return afterConflict;

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO artists (name, created_at, updated_at)
         VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(name)
      .run();
  } catch {
    /* ignore — lookup below */
  }

  const afterIgnore = await findArtistIdForName(db, name);
  if (afterIgnore != null) return afterIgnore;

  const ins = await db
    .prepare(
      `INSERT INTO artists (name, created_at, updated_at)
       VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(name)
    .run();

  const fromMeta = parseD1LastRowId((ins as { meta?: { last_row_id?: unknown } }).meta?.last_row_id);
  if (fromMeta != null) {
    const confirmed = await firstArtistId(db, 'SELECT id FROM artists WHERE id = ?', fromMeta);
    if (confirmed != null) return confirmed;
  }

  const last = await findArtistIdForName(db, name);
  if (last != null) return last;

  throw new Error(`Could not resolve artist id for ${JSON.stringify(name)}`);
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
 * for every `user_favorite_artists` row (same source as “From artists you follow”).
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
