import { describe, expect, it } from 'vitest';
import {
  getOrCreateArtistIdByName,
  normalizeArtistDisplayName,
  resolveArtistIdForFavoriteName,
} from './favorite-artists-sync';

type ArtistRow = { id: number; name: string };

function createArtistsMockDb(initial: ArtistRow[] = [], opts?: { orIgnoreThrowsUnique?: boolean }) {
  const artists = [...initial];
  let nextId = artists.reduce((m, r) => Math.max(m, r.id), 0) + 1;

  const db = {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
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
              return null;
            },
            async run() {
              if (s.startsWith('insert or ignore into artists')) {
                const name = String(args[0]);
                if (artists.some((a) => a.name === name)) {
                  if (opts?.orIgnoreThrowsUnique) {
                    throw new Error(
                      'D1_ERROR: UNIQUE constraint failed: artists.name: SQLITE_CONSTRAINT',
                    );
                  }
                  return { success: true, meta: { last_row_id: 0 } };
                }
                artists.push({ id: nextId++, name });
                return { success: true, meta: { last_row_id: artists[artists.length - 1].id } };
              }
              return { success: true, meta: { last_row_id: 0 } };
            },
            async all() {
              if (s.includes('lower(name) like')) {
                const pattern = String(args[0]).replace(/%/g, '').toLowerCase();
                const results = artists
                  .filter((a) => a.name.toLowerCase().includes(pattern.split(' ')[0] ?? ''))
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

  it('resolves Olivia Rodrigo when row exists with different casing', async () => {
    const { db } = createArtistsMockDb([{ id: 3, name: 'olivia rodrigo' }]);
    await expect(getOrCreateArtistIdByName(db, 'Olivia Rodrigo')).resolves.toBe(3);
  });

  it('recovers when INSERT OR IGNORE throws UNIQUE (D1)', async () => {
    const { db } = createArtistsMockDb([{ id: 7, name: 'Olivia Rodrigo' }], {
      orIgnoreThrowsUnique: true,
    });
    await expect(getOrCreateArtistIdByName(db, 'Olivia Rodrigo')).resolves.toBe(7);
  });
});
