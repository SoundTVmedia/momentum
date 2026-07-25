import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIP_SHOW_KEY_SQL } from './past-show-sql';

describe('CLIP_SHOW_KEY_SQL', () => {
  const databases: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  function createDb(): DatabaseSync {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE clips (
        id INTEGER PRIMARY KEY,
        artist_name TEXT,
        venue_name TEXT,
        timestamp TEXT,
        jambase_event_id TEXT,
        show_id TEXT
      )
    `);
    return db;
  }

  it('groups clips from one show and separates the next night', () => {
    const db = createDb();
    const insert = db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id)
      VALUES (?, 'Phish', 'Madison Square Garden', ?, NULL, ?)
    `);
    insert.run(1, '2025-04-20T01:00:00.000Z', 'phish-msg-2025-04-20');
    insert.run(2, '2025-04-20T03:00:00.000Z', 'phish-msg-2025-04-20');
    insert.run(3, '2025-04-21T01:00:00.000Z', 'phish-msg-2025-04-21');

    const rows = db
      .prepare(`
        SELECT ${CLIP_SHOW_KEY_SQL} AS show_id, COUNT(*) AS clip_count
        FROM clips
        GROUP BY ${CLIP_SHOW_KEY_SQL}
        ORDER BY show_id
      `)
      .all() as Array<{ show_id: string; clip_count: number }>;

    expect(rows).toEqual([
      { show_id: 'phish-msg-2025-04-20', clip_count: 2 },
      { show_id: 'phish-msg-2025-04-21', clip_count: 1 },
    ]);
  });

  it('falls back to artist, venue, and date for legacy clips without ids', () => {
    const db = createDb();
    const insert = db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id)
      VALUES (?, 'Phish', 'Madison Square Garden', ?, NULL, NULL)
    `);
    insert.run(1, '2025-04-20T01:00:00.000Z');
    insert.run(2, '2025-04-21T01:00:00.000Z');

    const rows = db
      .prepare(`
        SELECT ${CLIP_SHOW_KEY_SQL} AS show_id
        FROM clips
        GROUP BY ${CLIP_SHOW_KEY_SQL}
        ORDER BY show_id
      `)
      .all() as Array<{ show_id: string }>;

    expect(rows).toEqual([
      { show_id: 'phish|madison square garden|2025-04-20' },
      { show_id: 'phish|madison square garden|2025-04-21' },
    ]);
  });
});
