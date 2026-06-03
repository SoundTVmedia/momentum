import { describe, expect, it } from 'vitest';
import {
  getMyFollowing,
  getMyFollowingUsers,
  isUserFollowTargetId,
  toggleFollow,
} from './follow-endpoints';

type Stmt = {
  sql: string;
  args: unknown[];
  firstResult: unknown;
  allResults: unknown[];
  runCalls: number;
};

function makeDb(stmts: Stmt[]) {
  const find = (sql: string, args: unknown[]) =>
    stmts.find(
      (s) =>
        s.sql.replace(/\s+/g, ' ').trim() === sql.replace(/\s+/g, ' ').trim() &&
        JSON.stringify(s.args) === JSON.stringify(args),
    );

  const db = {
    prepare(sql: string) {
      const bound = {
        bind(...args: unknown[]) {
          return {
            async first() {
              const row = find(sql, args);
              if (row) row.runCalls += 1;
              return row?.firstResult ?? null;
            },
            async all() {
              const row = find(sql, args);
              if (row) row.runCalls += 1;
              return { results: row?.allResults ?? [] };
            },
            async run() {
              const row = find(sql, args);
              if (row) row.runCalls += 1;
              return { meta: { last_row_id: 1 } };
            },
          };
        },
      };
      return bound;
    },
  };
  return db as unknown as D1Database;
}

function mockContext(db: D1Database, userId: string, paramUserId: string) {
  const jsonBody: { artist_name?: string } = {};
  return {
    get: (key: string) => (key === 'user' ? { id: userId } : undefined),
    req: {
      param: (name: string) => (name === 'userId' ? paramUserId : ''),
      json: async () => jsonBody,
    },
    env: { DB: db },
    json: (body: unknown, status?: number) => ({
      status: status ?? 200,
      body,
    }),
  } as unknown as Parameters<typeof toggleFollow>[0];
}

describe('isUserFollowTargetId', () => {
  it('accepts user ids and rejects artist/venue targets', () => {
    expect(isUserFollowTargetId('user-2')).toBe(true);
    expect(isUserFollowTargetId('venue-5')).toBe(false);
    expect(isUserFollowTargetId('artist-3')).toBe(false);
    expect(isUserFollowTargetId('artist-name:taylor swift')).toBe(false);
  });
});

describe('follow-endpoints', () => {
  it('getMyFollowing merges follows rows and favorite artists', async () => {
    const followStmt: Stmt = {
      sql: 'SELECT following_id FROM follows WHERE follower_id = ?',
      args: ['user-1'],
      firstResult: null,
      allResults: [{ following_id: 'venue-5' }, { following_id: 'user-2' }],
      runCalls: 0,
    };
    const favNamesStmt: Stmt = {
      sql: `SELECT artists.name AS name FROM user_favorite_artists LEFT JOIN artists ON artists.id = user_favorite_artists.artist_id WHERE user_favorite_artists.mocha_user_id = ?`,
      args: ['user-1'],
      allResults: [{ name: 'Olivia Rodrigo' }],
      firstResult: null,
      runCalls: 0,
    };
    const profileStmt: Stmt = {
      sql: 'SELECT favorite_artists FROM user_profiles WHERE mocha_user_id = ?',
      args: ['user-1'],
      firstResult: { favorite_artists: null },
      allResults: [],
      runCalls: 0,
    };
    const favIdsStmt: Stmt = {
      sql: `SELECT user_favorite_artists.artist_id AS artist_id FROM user_favorite_artists WHERE user_favorite_artists.mocha_user_id = ?`,
      args: ['user-1'],
      allResults: [{ artist_id: 3 }],
      firstResult: null,
      runCalls: 0,
    };

    const db = makeDb([followStmt, favNamesStmt, profileStmt, favIdsStmt]);
    const c = {
      get: () => ({ id: 'user-1' }),
      env: { DB: db },
      json: (body: unknown) => ({ body }),
    } as unknown as Parameters<typeof getMyFollowing>[0];

    const res = (await getMyFollowing(c)) as unknown as { body: { following_ids: string[] } };
    const ids = res.body.following_ids;
    expect(ids).toContain('venue-5');
    expect(ids).toContain('user-2');
    expect(ids).toContain('artist-3');
    expect(ids).toContain('artist-name:olivia rodrigo');
  });

  it('getMyFollowingUsers returns profiles for user follows only', async () => {
    const followStmt: Stmt = {
      sql: `SELECT following_id, created_at FROM follows WHERE follower_id = ? ORDER BY created_at DESC`,
      args: ['user-1'],
      firstResult: null,
      allResults: [
        { following_id: 'venue-5', created_at: '2026-01-01' },
        { following_id: 'user-2', created_at: '2026-01-02' },
        { following_id: 'artist-3', created_at: '2026-01-03' },
      ],
      runCalls: 0,
    };
    const profileStmt: Stmt = {
      sql: `SELECT mocha_user_id, display_name, profile_image_url, role, is_verified FROM user_profiles WHERE mocha_user_id IN (?)`,
      args: ['user-2'],
      firstResult: null,
      allResults: [
        {
          mocha_user_id: 'user-2',
          display_name: 'Alex',
          profile_image_url: null,
          role: 'fan',
          is_verified: 0,
        },
      ],
      runCalls: 0,
    };

    const db = makeDb([followStmt, profileStmt]);
    const c = {
      get: () => ({ id: 'user-1' }),
      env: { DB: db },
      json: (body: unknown) => ({ body }),
    } as unknown as Parameters<typeof getMyFollowingUsers>[0];

    const res = (await getMyFollowingUsers(c)) as unknown as {
      body: { users: { mocha_user_id: string; display_name: string }[] };
    };
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]?.mocha_user_id).toBe('user-2');
    expect(res.body.users[0]?.display_name).toBe('Alex');
  });

  it('toggleFollow toggles venue without user notification target', async () => {
    const venueSelect: Stmt = {
      sql: 'SELECT id FROM venues WHERE id = ?',
      args: [12],
      firstResult: { id: 12 },
      allResults: [],
      runCalls: 0,
    };
    const existing: Stmt = {
      sql: 'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      args: ['user-1', 'venue-12'],
      firstResult: null,
      allResults: [],
      runCalls: 0,
    };
    const insert: Stmt = {
      sql: 'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      args: ['user-1', 'venue-12'],
      firstResult: null,
      allResults: [],
      runCalls: 0,
    };

    const db = makeDb([venueSelect, existing, insert]);
    const c = mockContext(db, 'user-1', 'venue-12');
    const res = (await toggleFollow(c)) as unknown as { body: { following: boolean } };
    expect(res.body.following).toBe(true);
    expect(insert.runCalls).toBe(1);
  });
});
