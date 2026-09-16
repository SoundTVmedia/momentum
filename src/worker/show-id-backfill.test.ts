import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { __testing } from './show-id-backfill';

function asD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      const withStatement = <T>(fn: (stmt: ReturnType<DatabaseSync['prepare']>) => T): T => {
        const stmt = db.prepare(sql);
        return fn(stmt);
      };
      const bound = (params: SQLInputValue[]) => ({
        async all() {
          const results = withStatement((stmt) =>
            params.length > 0 ? stmt.all(...params) : stmt.all(),
          );
          return { results };
        },
        async first() {
          const row = withStatement((stmt) =>
            params.length > 0 ? stmt.get(...params) : stmt.get(),
          );
          return row ?? null;
        },
        async run() {
          withStatement((stmt) => (params.length > 0 ? stmt.run(...params) : stmt.run()));
          return { success: true };
        },
      });
      return {
        bind(...params: SQLInputValue[]) {
          return bound(params);
        },
        ...bound([]),
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

  it('detaches a Dec Phish clip wrongly tagged with a July JamBase event id', async () => {
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
        event_title TEXT,
        updated_at TEXT
      )
    `);
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (349, 'Phish', 'Madison Square Garden', '2025-12-29T03:24:42.000Z', 'jambase:15668779', 'jambase:15668779', 'Phish at Madison Square Garden'),
        (351, 'Phish', 'Madison Square Garden', '2026-07-28T00:55:35.531Z', 'jambase:15668779', 'jambase:15668779', 'Phish at Madison Square Garden'),
        (325, 'Phish', 'Madison Square Garden', '2026-07-28T01:20:22.502Z', 'jambase:15668779', 'jambase:15668779', 'Phish at Madison Square Garden')
    `).run();

    const updated = await __testing.detachOutlierJamBaseShowIdsBatch({
      DB: asD1(db),
    } as Env);

    expect(updated).toBe(1);
    const december = db
      .prepare('SELECT show_id, jambase_event_id FROM clips WHERE id = 349')
      .get() as { show_id: string; jambase_event_id: string | null };
    const july = db
      .prepare('SELECT show_id, jambase_event_id FROM clips WHERE id = 351')
      .get() as { show_id: string; jambase_event_id: string | null };
    expect(december).toEqual({
      show_id: 'phish-madison-square-garden-2025-12-29',
      jambase_event_id: null,
    });
    expect(july).toEqual({
      show_id: 'jambase:15668779',
      jambase_event_id: 'jambase:15668779',
    });
  });
});
