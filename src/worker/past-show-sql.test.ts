import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIP_SHOW_KEY_SQL, clipBelongsToEventTitleSql, clipBelongsToRequestedShowSql, CLIP_BELONGS_TO_SHOW_BIND_COUNT, LATEST_SCENE_CLIP_FRESH_30D_SQL, LATEST_SCENE_CLIP_FRESH_SQL } from './past-show-sql';

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

describe('clipBelongsToRequestedShowSql', () => {
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
        show_id TEXT,
        event_title TEXT
      )
    `);
    return db;
  }

  it('returns every clip for a show even when show_id and jambase ids differ', () => {
    const db = createDb();
    const insert = db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES (?, 'Phish', 'Madison Square Garden', '2025-04-20T01:00:00.000Z', ?, ?, ?)
    `);
    insert.run(1, 'jambase:123', 'phish-msg-2025-04-20', 'Phish at Madison Square Garden');
    insert.run(2, 'jambase:123', 'jambase:123', 'Phish');
    insert.run(3, 'jambase:999', 'other-show', 'Other Night');

    const sql = `SELECT id FROM clips WHERE ${clipBelongsToRequestedShowSql()} ORDER BY id`;
    const showBinds = Array.from(
      { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
      () => 'phish-msg-2025-04-20',
    );
    const eventBinds = Array.from(
      { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
      () => 'jambase:123',
    );
    const byComposite = db.prepare(sql).all(...showBinds) as Array<{ id: number }>;
    const byEventId = db.prepare(sql).all(...eventBinds) as Array<{ id: number }>;

    expect(byComposite).toEqual([{ id: 1 }, { id: 2 }]);
    expect(byEventId).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('includes clips that share a title-linked show identity', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Phish', 'MSG', '2025-04-20T01:00:00.000Z', 'jambase:123', 'jambase:123', 'Phish at MSG'),
        (2, 'Phish', 'MSG', '2025-04-20T03:00:00.000Z', 'jambase:123', 'phish-msg-2025-04-20', NULL)
    `).run();

    const rows = db
      .prepare(`SELECT id FROM clips WHERE ${clipBelongsToEventTitleSql()} ORDER BY id`)
      .all('Phish at MSG', 'Phish at MSG', 'Phish at MSG') as Array<{ id: number }>;

    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
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

  it('keeps a just-uploaded clip tagged to a show from 30 hours ago in the 30-day window', () => {
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

    const rows24 = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_SQL}`,
      )
      .all() as Array<{ id: number }>;
    const rows30 = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_30D_SQL}`,
      )
      .all() as Array<{ id: number }>;

    expect(rows24).toEqual([]);
    expect(rows30).toEqual([{ id: 1 }]);
  });

  it('drops a clip posted more than 30 days after the tagged show', () => {
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
    ).run('old-show', new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString());
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now'), datetime('now'), 'old-show')`,
    ).run();

    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_30D_SQL}`,
      )
      .all() as Array<{ id: number }>;

    expect(rows).toEqual([]);
  });
});
