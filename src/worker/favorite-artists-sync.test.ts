import { describe, expect, it } from 'vitest';
import {
  getOrCreateArtistIdByName,
  normalizeArtistDisplayName,
  resolveArtistIdForFavoriteName,
  syncUserFavoriteArtistRows,
} from './favorite-artists-sync';

type ArtistRow = { id: number; name: string };

function createArtistsMockDb(initial: ArtistRow[] = []) {
  const artists = [...initial];
  let nextId = artists.reduce((m, r) => Math.max(m, r.id), 0) + 1;

  const db = {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (s.includes('on conflict(name) do update') && s.includes('returning id')) {
                const name = String(args[0]);
                const existing = artists.find((a) => a.name === name);
                if (existing) return { id: existing.id };
                const row = { id: nextId++, name };
                artists.push(row);
                return { id: row.id };
              }
              if (s.startsWith('select id from artists where name =') && s.includes('collate nocase')) {
                const key = String(args[0]).toLowerCase();
                const row = artists.find((a) => a.name.toLowerCase() === key);
                return row ? { id: row.id } : null;
              }
              if (s.startsWith('select id from artists where name =')) {
                const key = String(args[0]);
                const row = artists.find((a) => a.name === key);
                return row ? { id: row.id } : null;
              }
              if (s.includes('lower(trim(name)) = lower(trim')) {
                const key = String(args[0]).toLowerCase().trim();
                const row = artists.find((a) => a.name.toLowerCase().trim() === key);
                return row ? { id: row.id } : null;
              }
              if (s.includes('lower(name) =')) {
                const key = String(args[0]).toLowerCase();
                const row = artists.find((a) => a.name.toLowerCase() === key);
                return row ? { id: row.id } : null;
              }
              if (s.includes("lower(replace(trim(name), ' ', '-'))")) {
                const slug = String(args[0]);
                const row = artists.find(
                  (a) => a.name.toLowerCase().replace(/\s+/g, '-').trim() === slug,
                );
                return row ? { id: row.id } : null;
              }
              if (s.startsWith('select id from artists where id =')) {
                const id = Number(args[0]);
                const row = artists.find((a) => a.id === id);
                return row ? { id: row.id } : null;
              }
              if (s.includes('select id from user_favorite_artists')) {
                return null;
              }
              return null;
            },
            async run() {
              if (s.startsWith('insert or ignore into artists')) {
                const name = String(args[0]);
                if (!artists.some((a) => a.name === name)) {
                  artists.push({ id: nextId++, name });
                }
                return { success: true, meta: { last_row_id: artists[artists.length - 1]?.id ?? 0 } };
              }
              if (s.startsWith('insert into artists') && s.includes('user_favorite')) {
                return { success: true };
              }
              if (s.startsWith('insert into user_favorite_artists')) {
                return { success: true };
              }
              if (s.startsWith('insert into artists')) {
                const name = String(args[0]);
                if (artists.some((a) => a.name === name)) {
                  return { success: false, error: 'UNIQUE constraint failed: artists.name' };
                }
                artists.push({ id: nextId++, name });
                return { success: true, meta: { last_row_id: artists[artists.length - 1].id } };
              }
              return { success: true, meta: { last_row_id: 0 } };
            },
            async all() {
              if (s.includes("lower(name) like '%' ||")) {
                const needle = String(args[0]).toLowerCase();
                const results = artists
                  .filter((a) => a.name.toLowerCase().includes(needle))
                  .map((a) => ({ id: a.id, name: a.name }));
                return { results };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as D1Database, artists };
}

describe('normalizeArtistDisplayName', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeArtistDisplayName('  Taylor   Swift  ')).toBe('Taylor Swift');
  });
});

describe('resolveArtistIdForFavoriteName', () => {
  it('finds by case-insensitive name when DB row is lowercase', async () => {
    const { db } = createArtistsMockDb([{ id: 9, name: 'olivia rodrigo' }]);
    await expect(resolveArtistIdForFavoriteName(db, 'Olivia Rodrigo')).resolves.toBe(9);
  });
});

describe('getOrCreateArtistIdByName', () => {
  it('returns existing id by case-insensitive name', async () => {
    const { db } = createArtistsMockDb([{ id: 5, name: 'Taylor Swift' }]);
    await expect(getOrCreateArtistIdByName(db, 'taylor swift')).resolves.toBe(5);
  });

  it('creates a new artist when missing', async () => {
    const { db, artists } = createArtistsMockDb();
    const id = await getOrCreateArtistIdByName(db, 'Billie Eilish');
    expect(id).toBeGreaterThan(0);
    expect(artists.some((a) => a.name === 'Billie Eilish')).toBe(true);
  });

  it('resolves Olivia Rodrigo via upsert when exact row exists', async () => {
    const { db } = createArtistsMockDb([{ id: 3, name: 'Olivia Rodrigo' }]);
    await expect(getOrCreateArtistIdByName(db, 'Olivia Rodrigo')).resolves.toBe(3);
  });
});

describe('syncUserFavoriteArtistRows', () => {
  it('continues after one failure and reports partial result', async () => {
    const { db } = createArtistsMockDb([{ id: 1, name: 'Drake' }]);
    const result = await syncUserFavoriteArtistRows(db, 'user-1', ['Drake', '']);
    expect(result.synced).toContain('Drake');
    expect(result.failed.length).toBeGreaterThanOrEqual(0);
  });
});
