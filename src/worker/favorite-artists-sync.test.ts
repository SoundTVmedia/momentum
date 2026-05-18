import { describe, expect, it } from 'vitest';
import { getOrCreateArtistIdByName, normalizeArtistDisplayName } from './favorite-artists-sync';

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
                if (!artists.some((a) => a.name === name)) {
                  artists.push({ id: nextId++, name });
                }
                return { success: true, meta: { last_row_id: artists[artists.length - 1]?.id ?? 0 } };
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

  it('resolves after insert-or-ignore race', async () => {
    const { db } = createArtistsMockDb([{ id: 2, name: 'Drake' }]);
    await expect(getOrCreateArtistIdByName(db, 'Drake')).resolves.toBe(2);
  });
});
