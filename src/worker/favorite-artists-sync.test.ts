import { describe, expect, it } from 'vitest';
import {
  getOrCreateArtistIdByName,
  linkFavoriteArtistByName,
  normalizeArtistDisplayName,
  resolveArtistIdForFavoriteName,
  syncUserFavoriteArtistRows,
  toggleArtistFollowFavorite,
} from './favorite-artists-sync';

type ArtistRow = { id: number; name: string };

function createArtistsMockDb(initial: ArtistRow[] = []) {
  const artists = [...initial];
  const links: { uid: string; artistId: number }[] = [];
  let nextId = artists.reduce((m, r) => Math.max(m, r.id), 0) + 1;

  const db = {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (s.includes('from user_favorite_artists ufa') && s.includes('lower(trim(a.name))')) {
                const uid = String(args[0]);
                const name = String(args[1]).toLowerCase().trim();
                const hit = links.find((l) => {
                  if (l.uid !== uid) return false;
                  const a = artists.find((x) => x.id === l.artistId);
                  return a != null && a.name.toLowerCase().trim() === name;
                });
                return hit ? { id: 1 } : null;
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
              if (s.includes('select id, favorite_artists from user_profiles')) {
                return null;
              }
              if (s.includes('select favorite_artists from user_profiles')) {
                return null;
              }
              if (
                s.includes('from user_favorite_artists') &&
                s.includes('mocha_user_id = ?') &&
                s.includes('artist_id = ?') &&
                !s.includes('inner join')
              ) {
                const uid = String(args[0]);
                const artistId = Number(args[1]);
                const hit = links.find((l) => l.uid === uid && l.artistId === artistId);
                return hit ? { id: 1 } : null;
              }
              if (s.includes('from user_favorite_artists') && s.includes('inner join artists')) {
                const uid = String(args[0]);
                return {
                  results: links
                    .filter((l) => l.uid === uid)
                    .map((l) => {
                      const a = artists.find((x) => x.id === l.artistId);
                      return { name: a?.name ?? '' };
                    }),
                };
              }
              return null;
            },
            async run() {
              if (s.includes('insert into user_favorite_artists') && s.includes('select')) {
                const uid = String(args[0]);
                const name = String(args[1]).toLowerCase().trim();
                const exact = String(args[2]);
                const row =
                  artists.find((a) => a.name.toLowerCase().trim() === name) ??
                  artists.find((a) => a.name === exact);
                if (row && !links.some((l) => l.uid === uid && l.artistId === row.id)) {
                  links.push({ uid, artistId: row.id });
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }
              if (s.startsWith('insert or ignore into artists')) {
                const name = String(args[0]);
                if (!artists.some((a) => a.name === name)) {
                  artists.push({ id: nextId++, name });
                }
                return { success: true, meta: { changes: 1, last_row_id: artists[artists.length - 1]?.id } };
              }
              if (s.startsWith('insert or ignore into user_favorite_artists')) {
                const uid = String(args[0]);
                const artistId = Number(args[1]);
                if (!links.some((l) => l.uid === uid && l.artistId === artistId)) {
                  links.push({ uid, artistId });
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }
              if (s.startsWith('delete from user_favorite_artists') && s.includes('artist_id = ?')) {
                const uid = String(args[0]);
                const artistId = Number(args[1]);
                const before = links.length;
                for (let i = links.length - 1; i >= 0; i--) {
                  if (links[i]?.uid === uid && links[i]?.artistId === artistId) {
                    links.splice(i, 1);
                  }
                }
                return { success: true, meta: { changes: before - links.length } };
              }
              if (s.startsWith('delete from user_favorite_artists') && s.includes('artist_id in')) {
                const uid = String(args[0]);
                const name = String(args[1]).toLowerCase().trim();
                const before = links.length;
                for (let i = links.length - 1; i >= 0; i--) {
                  const l = links[i];
                  if (!l || l.uid !== uid) continue;
                  const a = artists.find((x) => x.id === l.artistId);
                  if (a && a.name.toLowerCase().trim() === name) links.splice(i, 1);
                }
                return { success: true, meta: { changes: before - links.length } };
              }
              if (s.includes('insert into user_profiles')) {
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
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
  return { db: db as unknown as D1Database, artists, links };
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
});

describe('linkFavoriteArtistByName', () => {
  it('links existing artist without creating duplicate', async () => {
    const { db, links } = createArtistsMockDb([{ id: 3, name: 'Olivia Rodrigo' }]);
    await linkFavoriteArtistByName(db, 'user-1', 'Olivia Rodrigo');
    expect(links).toHaveLength(1);
    expect(links[0]?.artistId).toBe(3);
  });
});

describe('syncUserFavoriteArtistRows', () => {
  it('syncs multiple names', async () => {
    const { db } = createArtistsMockDb([{ id: 1, name: 'Drake' }]);
    const result = await syncUserFavoriteArtistRows(db, 'user-1', ['Drake', 'New Artist']);
    expect(result.synced).toContain('Drake');
    expect(result.synced).toContain('New Artist');
  });
});

describe('toggleArtistFollowFavorite', () => {
  it('links by canonical name when URL artist id is stale', async () => {
    const { db, links } = createArtistsMockDb([{ id: 3, name: 'Olivia Rodrigo' }]);
    const follow = await toggleArtistFollowFavorite(db, 'user-1', 99, 'Olivia Rodrigo');
    expect(follow.following).toBe(true);
    expect(follow.artist_id).toBe(3);
    expect(links.some((l) => l.uid === 'user-1' && l.artistId === 3)).toBe(true);

    const unfollow = await toggleArtistFollowFavorite(db, 'user-1', 99, 'Olivia Rodrigo');
    expect(unfollow.following).toBe(false);
    expect(links.some((l) => l.uid === 'user-1')).toBe(false);
  });
});
