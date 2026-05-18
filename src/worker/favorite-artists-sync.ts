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

function artistNameSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').trim();
}

function isSqliteUniqueError(msg: string): boolean {
  return /unique constraint|UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(msg);
}

/**
 * Exact stored name, then case-insensitive + trim match (SQLite UNIQUE on `name` is exact-only).
 */
async function findArtistIdByName(db: D1Database, name: string): Promise<number | null> {
  const key = normalizeArtistDisplayName(name);
  if (!key) return null;

  const exact = (await db.prepare('SELECT id FROM artists WHERE name = ?').bind(key).first()) as {
    id: unknown;
  } | null;
  const eid = rowIdToNumber(exact?.id);
  if (eid != null) return eid;

  const fold = (await db
    .prepare(
      `SELECT id FROM artists
       WHERE lower(trim(name)) = lower(trim(?))
       ORDER BY id ASC
       LIMIT 1`,
    )
    .bind(key)
    .first()) as { id: unknown } | null;
  return rowIdToNumber(fold?.id);
}

/** Match artist pages / slug URLs when spacing differs (e.g. "foo fighters" vs stored variant). */
async function findArtistIdBySlug(db: D1Database, name: string): Promise<number | null> {
  const key = normalizeArtistDisplayName(name);
  const slug = artistNameSlug(key);
  if (!slug) return null;

  const row = (await db
    .prepare(
      `SELECT id FROM artists
       WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ?
       ORDER BY id ASC
       LIMIT 1`,
    )
    .bind(slug)
    .first()) as { id: unknown } | null;
  return rowIdToNumber(row?.id);
}

async function resolveArtistIdAfterWrite(db: D1Database, name: string): Promise<number | null> {
  return (await findArtistIdByName(db, name)) ?? (await findArtistIdBySlug(db, name));
}

export async function getOrCreateArtistIdByName(db: D1Database, displayName: string): Promise<number> {
  const name = normalizeArtistDisplayName(displayName);
  if (!name) {
    throw new Error('empty artist name');
  }

  const existing = await resolveArtistIdAfterWrite(db, name);
  if (existing != null) return existing;

  // Idempotent — safe when RETURNING / last_row_id are flaky on D1
  await db
    .prepare(
      `INSERT OR IGNORE INTO artists (name, created_at, updated_at)
       VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(name)
    .run();

  let id = await resolveArtistIdAfterWrite(db, name);
  if (id != null) return id;

  try {
    const ins = await db
      .prepare(
        `INSERT INTO artists (name, created_at, updated_at)
         VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(name)
      .run();

    const insAny = ins as { success?: boolean; error?: string; meta?: { last_row_id?: unknown } };
    if (insAny.success === false) {
      const retry = await resolveArtistIdAfterWrite(db, name);
      if (retry != null) return retry;
      throw new Error(
        `Artist insert failed (${JSON.stringify(name)}): ${insAny.error ?? 'D1 returned success: false'}`,
      );
    }

    const fromMeta = parseD1LastRowId(insAny.meta?.last_row_id);
    if (fromMeta != null) {
      const byId = (await db.prepare('SELECT id FROM artists WHERE id = ?').bind(fromMeta).first()) as {
        id: unknown;
      } | null;
      const confirmed = rowIdToNumber(byId?.id);
      if (confirmed != null) return confirmed;
    }

    id = await resolveArtistIdAfterWrite(db, name);
    if (id != null) return id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retry = await resolveArtistIdAfterWrite(db, name);
    if (retry != null) return retry;
    if (isSqliteUniqueError(msg)) {
      const afterUnique = await resolveArtistIdAfterWrite(db, name);
      if (afterUnique != null) return afterUnique;
    }
    throw new Error(`Artist insert failed (${JSON.stringify(name)}): ${msg}`);
  }

  throw new Error(`Could not resolve artist id for ${JSON.stringify(name)}`);
}

/** Ensure `user_favorite_artists` rows exist for each display name. */
export async function syncUserFavoriteArtistRows(
  db: D1Database,
  uid: string,
  names: string[],
): Promise<void> {
  const normalized = [
    ...new Set(names.map((n) => normalizeArtistDisplayName(String(n ?? ''))).filter(Boolean)),
  ].slice(0, 25);
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
  if (canonical.length === 0) return;
  await mergeProfileFavoriteArtistsJson(db, uid, canonical);
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
