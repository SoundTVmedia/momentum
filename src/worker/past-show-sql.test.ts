import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIP_SHOW_KEY_SQL, LATEST_SCENE_CLIP_FRESH_SQL } from './past-show-sql';

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

describe('LATEST_SCENE_CLIP_FRESH_SQL', () => {
  const databases: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of databases.splice(0)) db.close();
  });

  it('keeps clips from a show in the last 24 hours and drops older shows', () => {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE clips (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        created_at TEXT,
        jambase_event_id TEXT
      );
      CREATE TABLE jambase_events (
        jambase_event_id TEXT PRIMARY KEY,
        start_date TEXT
      );
    `);
    db.prepare(
      `INSERT INTO jambase_events (jambase_event_id, start_date) VALUES (?, datetime('now', '-2 hours'))`,
    ).run('fresh');
    db.prepare(
      `INSERT INTO jambase_events (jambase_event_id, start_date) VALUES (?, datetime('now', '-30 hours'))`,
    ).run('stale');
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now', '-2 hours'), datetime('now'), 'fresh')`,
    ).run();
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (2, datetime('now', '-30 hours'), datetime('now'), 'stale')`,
    ).run();

    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_SQL}
         ORDER BY clips.id`,
      )
      .all() as Array<{ id: number }>;

    expect(rows).toEqual([{ id: 1 }]);
  });

  it('keeps unmatched clips whose recording time is older than 24 hours', () => {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE clips (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        created_at TEXT,
        jambase_event_id TEXT
      );
      CREATE TABLE jambase_events (
        jambase_event_id TEXT PRIMARY KEY,
        start_date TEXT
      );
    `);
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now', '-48 hours'), datetime('now'), NULL)`,
    ).run();
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (2, ?, datetime('now'), NULL)`,
    ).run(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_SQL}
         ORDER BY clips.id`,
      )
      .all() as Array<{ id: number }>;

    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('drops a just-uploaded clip tagged to a show that started more than 24 hours ago', () => {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE clips (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        created_at TEXT,
        jambase_event_id TEXT
      );
      CREATE TABLE jambase_events (
        jambase_event_id TEXT PRIMARY KEY,
        start_date TEXT
      );
    `);
    db.prepare(
      `INSERT INTO jambase_events (jambase_event_id, start_date) VALUES (?, ?)`,
    ).run('past-show', new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString());
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now'), datetime('now'), 'past-show')`,
    ).run();

    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_SQL}`,
      )
      .all() as Array<{ id: number }>;

    expect(rows).toEqual([]);
  });
});
