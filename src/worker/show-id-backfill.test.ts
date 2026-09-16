import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { __testing } from './show-id-backfill';

function asD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          const runWithParams = <T>(fn: (stmt: ReturnType<DatabaseSync['prepare']>) => T): T => {
            const stmt = db.prepare(sql);
            return fn(stmt);
          };
          return {
            async all() {
              const results = runWithParams((stmt) =>
                params.length > 0 ? stmt.all(...params) : stmt.all(),
              );
              return { results };
            },
            async first() {
              const row = runWithParams((stmt) =>
                params.length > 0 ? stmt.get(...params) : stmt.get(),
              );
              return row ?? null;
            },
            async run() {
              runWithParams((stmt) => (params.length > 0 ? stmt.run(...params) : stmt.run()));
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('promoteSiblingJamBaseShowIdsBatch', () => {
  const databases: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  it('upgrades the earliest Ariana slug clip to the sibling JamBase show id', async () => {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE clips (
        id INTEGER PRIMARY KEY,
        artist_name TEXT,
        venue_name TEXT,
        timestamp TEXT,
        jambase_event_id TEXT,
        jambase_artist_id TEXT,
        jambase_venue_id TEXT,
        show_id TEXT,
        updated_at TEXT
      )
    `);
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, jambase_artist_id, jambase_venue_id, show_id)
      VALUES
        (131, 'Ariana Grande', 'Barclays Center', '2026-07-14T00:32:47.000Z', NULL, NULL, NULL, 'ariana-grande-barclays-center-2026-07-14'),
        (127, 'Ariana Grande', 'Barclays Center', '2026-07-14T00:44:57.227Z', 'jambase:14852021', 'jambase:artist', 'jambase:venue', 'jambase:14852021')
    `).run();

    const updated = await __testing.promoteSiblingJamBaseShowIdsBatch({
      DB: asD1(db),
    } as Env);

    expect(updated).toBe(1);
    const row = db.prepare('SELECT show_id, jambase_event_id, jambase_artist_id, jambase_venue_id FROM clips WHERE id = 131').get() as {
      show_id: string;
      jambase_event_id: string;
      jambase_artist_id: string;
      jambase_venue_id: string;
    };
    expect(row).toEqual({
      show_id: 'jambase:14852021',
      jambase_event_id: 'jambase:14852021',
      jambase_artist_id: 'jambase:artist',
      jambase_venue_id: 'jambase:venue',
    });
  });
});
