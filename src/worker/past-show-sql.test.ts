import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIP_SHOW_KEY_SQL, CLIP_PAST_SHOW_GROUP_KEY_SQL, clipBelongsToEventTitleSql, clipBelongsToRequestedShowSql, CLIP_BELONGS_TO_SHOW_BIND_COUNT, collapsePastShowRows, D1_MAX_SQL_STATEMENT_BYTES, festivalClipSearchSql, groupedPastShowIdSql, groupedPastShowsSelectSql, libraryShowNightKeySql, mergeClipAndLibraryPastShows, pastShowsAreSameConcert, pickCanonicalShowIdentity, showPageIdForPastShowCard, LATEST_SCENE_CLIP_FRESH_SQL, latestSceneClipFreshOrOwnSql, withShowClipMembership, type PastShowListRow } from './past-show-sql';

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

describe('CLIP_NIGHT_KEY_SQL', () => {
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
        created_at TEXT,
        jambase_event_id TEXT,
        jambase_venue_id TEXT,
        jambase_artist_id TEXT,
        show_id TEXT,
        event_title TEXT,
        location TEXT,
        thumbnail_url TEXT,
        stream_thumbnail_url TEXT,
        stream_video_id TEXT,
        average_rating REAL
      )
    `);
    return db;
  }

  it('merges JamBase show ids with composite slugs from the same night', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (127, 'Ariana Grande', 'Barclays Center', '2026-07-14T00:44:57.227Z', 'jambase:14852021', 'jambase:14852021', 'Ariana Grande at Barclays Center'),
        (131, 'Ariana Grande', 'Barclays Center', '2026-07-14T00:32:47.000Z', NULL, 'ariana-grande-barclays-center-2026-07-14', 'Ariana Grande at Barclays Center'),
        (200, 'Ryan Bingham', 'Irving Plaza', '2026-06-10T01:00:00.000Z', 'jambase:15658983', 'jambase:15658983', 'Ryan Bingham at Irving Plaza'),
        (201, 'Ryan Bingham', 'Irving Plaza', '2026-06-10T02:00:00.000Z', NULL, 'ryan-bingham-irving-plaza-2026-06-10', 'Ryan Bingham at Irving Plaza'),
        (300, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:15668773', 'jambase:15668773', 'Phish at Madison Square Garden'),
        (301, 'Phish', 'Madison Square Garden', '2026-07-26T01:00:00.000Z', 'jambase:15668776', 'jambase:15668776', 'Phish at Madison Square Garden')
    `).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY show_date ASC
      `)
      .all() as Array<{ show_id: string; clip_count: number; artist_name: string }>;

    expect(
      rows.map((row) => ({
        show_id: row.show_id,
        clip_count: row.clip_count,
        artist_name: row.artist_name,
      })),
    ).toEqual([
      { show_id: 'jambase:15658983', clip_count: 2, artist_name: 'Ryan Bingham' },
      { show_id: 'jambase:14852021', clip_count: 2, artist_name: 'Ariana Grande' },
      { show_id: 'jambase:15668773', clip_count: 1, artist_name: 'Phish' },
      { show_id: 'jambase:15668776', clip_count: 1, artist_name: 'Phish' },
    ]);
  });

  it('merges archival clips that share an event title but span capture days', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (27, 'Charlie Puth', 'Madison Square Garden', '2026-06-01T18:31:45.000Z', NULL, 'charlie-puth-madison-square-garden-2026-06-01', 'Charlie Puth at Madison Square Garden'),
        (28, 'Charlie Puth', 'Madison Square Garden', '2026-06-01T21:06:32.000Z', NULL, 'charlie-puth-madison-square-garden-2026-06-01', 'Charlie Puth at Madison Square Garden'),
        (36, 'Charlie Puth', 'Madison Square Garden', '2026-05-30T02:33:49.000Z', NULL, 'charlie-puth-madison-square-garden-2026-05-30', 'Charlie Puth at Madison Square Garden'),
        (300, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:15668773', 'jambase:15668773', 'Phish at Madison Square Garden'),
        (301, 'Phish', 'Madison Square Garden', '2026-07-26T01:00:00.000Z', 'jambase:15668776', 'jambase:15668776', 'Phish at Madison Square Garden')
    `).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY artist_name ASC, show_date ASC
      `)
      .all() as Array<{ show_id: string; clip_count: number; artist_name: string; show_date: string }>;

    expect(
      rows.map((row) => ({
        show_id: row.show_id,
        clip_count: row.clip_count,
        artist_name: row.artist_name,
      })),
    ).toEqual([
      {
        show_id: 'charlie-puth-madison-square-garden-2026-06-01',
        clip_count: 3,
        artist_name: 'Charlie Puth',
      },
      { show_id: 'jambase:15668773', clip_count: 1, artist_name: 'Phish' },
      { show_id: 'jambase:15668776', clip_count: 1, artist_name: 'Phish' },
    ]);
    expect(rows[0]?.show_date).toBe('2026-05-30T02:33:49.000Z');
  });

  it('groups a festival edition across artists and days, and keeps a residency split', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Foo Fighters', 'Piedmont Park', '2026-09-18T23:00:00.000Z', 'jambase:sk-fri', 'jambase:sk-fri', 'Shaky Knees 2026 - Friday'),
        (2, 'The National', 'Piedmont Park', '2026-09-19T23:00:00.000Z', 'jambase:sk-sat', 'jambase:sk-sat', 'The National at Shaky Knees'),
        (3, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:15668773', 'jambase:15668773', 'Phish at Madison Square Garden'),
        (4, 'Phish', 'Madison Square Garden', '2026-07-26T01:00:00.000Z', 'jambase:15668776', 'jambase:15668776', 'Phish at Madison Square Garden')
    `).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY clip_count DESC, artist_name ASC
      `)
      .all() as Array<{ clip_count: number; artist_name: string }>;

    expect(rows.map((row) => ({ artist_name: row.artist_name, clip_count: row.clip_count }))).toEqual([
      { artist_name: 'The National', clip_count: 2 },
      { artist_name: 'Phish', clip_count: 1 },
      { artist_name: 'Phish', clip_count: 1 },
    ]);

    const festivalClips = db
      .prepare(withShowClipMembership(`SELECT COUNT(*) as n FROM clips WHERE ${clipBelongsToRequestedShowSql()}`))
      .get(...Array.from({ length: CLIP_BELONGS_TO_SHOW_BIND_COUNT }, () => 'jambase:sk-fri')) as {
      n: number;
    };
    expect(festivalClips.n).toBe(2);
  });

  it('groups Summerfest days and does not treat Manifest as a festival', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Foo Fighters', 'Henry Maier Festival Park', '2026-07-02T23:00:00.000Z', 'jambase:sf-fri', 'jambase:sf-fri', 'Summerfest 2026 - Friday'),
        (2, 'The National', 'Henry Maier Festival Park', '2026-07-03T23:00:00.000Z', 'jambase:sf-sat', 'jambase:sf-sat', 'Summerfest Saturday'),
        (3, 'Artist A', 'The Wiltern', '2026-06-01T23:00:00.000Z', 'jambase:man-1', 'jambase:man-1', 'Manifest'),
        (4, 'Artist B', 'Red Rocks', '2026-06-02T23:00:00.000Z', 'jambase:man-2', 'jambase:man-2', 'Manifest')
    `).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY clip_count DESC, artist_name ASC
      `)
      .all() as Array<{ clip_count: number; artist_name: string; event_title: string }>;

    expect(rows.map((row) => ({ artist_name: row.artist_name, clip_count: row.clip_count }))).toEqual([
      { artist_name: 'The National', clip_count: 2 },
      { artist_name: 'Artist A', clip_count: 1 },
      { artist_name: 'Artist B', clip_count: 1 },
    ]);
  });

  it('loads this edition of a festival, including a performer set that omits the festival name', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Foo Fighters', 'Piedmont Park', '2026-09-18T23:00:00.000Z', 'jambase:sk-fri', 'jambase:sk-fri', 'Shaky Knees 2026 - Friday'),
        (2, 'The National', 'Piedmont Park', '2026-09-19T23:00:00.000Z', 'jambase:sk-sat', 'jambase:sk-sat', 'The National at Shaky Knees'),
        (3, 'Foo Fighters', 'Piedmont Park', '2026-09-19T20:00:00.000Z', 'jambase:sk-set', 'jambase:sk-set', 'Foo Fighters'),
        (4, 'Old Act', 'Piedmont Park', '2019-05-03T23:00:00.000Z', 'jambase:sk-2019', 'jambase:sk-2019', 'Shaky Knees 2019'),
        (5, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:phish', 'jambase:phish', 'Phish at Madison Square Garden')
    `).run();

    const sql = festivalClipSearchSql({
      titleNeedleCount: 1,
      eventIdCount: 1,
      editionYear: '2026',
    });
    const rows = db
      .prepare(`SELECT id FROM clips WHERE ${sql} ORDER BY id`)
      .all('shaky knees', 'jambase:sk-set', 'jambase:sk-set') as Array<{ id: number }>;
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('merges two JamBase ids for the same artist, venue, and night', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Jay-Z', 'Yankee Stadium', '2024-07-14T23:30:00.000Z', 'jambase:old', 'jambase:old', 'Jay-Z at Yankee Stadium'),
        (2, 'Jay Z', 'Yankee Stadium', '2024-07-14T23:50:00.000Z', 'jambase:new', 'jambase:new', 'Jay Z at Yankee Stadium'),
        (3, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:15668773', 'jambase:15668773', 'Phish at Madison Square Garden'),
        (4, 'Phish', 'Madison Square Garden', '2026-07-26T01:00:00.000Z', 'jambase:15668776', 'jambase:15668776', 'Phish at Madison Square Garden')
    `).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY artist_name ASC, show_date ASC
      `)
      .all() as Array<{ clip_count: number; artist_name: string }>;

    expect(rows.map((row) => ({ artist_name: row.artist_name, clip_count: row.clip_count }))).toEqual([
      { artist_name: 'Jay-Z', clip_count: 2 },
      { artist_name: 'Phish', clip_count: 1 },
      { artist_name: 'Phish', clip_count: 1 },
    ]);

    const jayZ = db
      .prepare(
        withShowClipMembership(`SELECT COUNT(*) as n FROM clips WHERE ${clipBelongsToRequestedShowSql()}`),
      )
      .get('jambase:new', 'jambase:new', 'jambase:new') as {
      n: number;
    };
    expect(jayZ.n).toBe(2);
  });

  it('merges a JamBase night with a UTC-next-day composite slug for the same billed show', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Foreigner', 'The Bell Auditorium', '2026-09-19T23:43:35.989Z', 'jambase:15705118', 'jambase:15705118', 'Foreigner at The Bell Auditorium'),
        (2, 'Foreigner', 'The Bell Auditorium', '2026-09-19T23:50:00.000Z', 'jambase:15705118', 'jambase:15705118', 'Foreigner at The Bell Auditorium'),
        (3, 'Foreigner', 'The Bell Auditorium', '2026-09-20T00:13:03.119Z', NULL, 'foreigner-the-bell-auditorium-2026-09-20', 'Foreigner at The Bell Auditorium'),
        (300, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:15668773', 'jambase:15668773', 'Phish at Madison Square Garden'),
        (301, 'Phish', 'Madison Square Garden', '2026-07-26T01:00:00.000Z', 'jambase:15668776', 'jambase:15668776', 'Phish at Madison Square Garden')
    `).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY artist_name ASC, show_date ASC
      `)
      .all() as Array<{ show_id: string; clip_count: number; artist_name: string }>;

    expect(
      rows.map((row) => ({
        show_id: row.show_id,
        clip_count: row.clip_count,
        artist_name: row.artist_name,
      })),
    ).toEqual([
      { show_id: 'jambase:15705118', clip_count: 3, artist_name: 'Foreigner' },
      { show_id: 'jambase:15668773', clip_count: 1, artist_name: 'Phish' },
      { show_id: 'jambase:15668776', clip_count: 1, artist_name: 'Phish' },
    ]);
  });

  it('collapses Foreigner-shaped duplicates: midnight spill, slug-as-jambase_id, and null timestamps', () => {
    const db = createDb();
    const insert = db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, created_at, jambase_event_id, show_id, event_title)
      VALUES (?, 'Foreigner', 'The Bell Auditorium', ?, ?, ?, ?, 'Foreigner at The Bell Auditorium')
    `);
    insert.run(361, '2026-09-19T23:43:35.989Z', null, 'jambase:15705118', 'jambase:15705118');
    insert.run(368, '2026-09-19T23:57:48.837Z', null, 'jambase:15705118', 'jambase:15705118');
    insert.run(370, '2026-09-20T00:11:57.952Z', null, null, 'foreigner-the-bell-auditorium-2026-09-20');
    insert.run(384, '2026-09-20T00:38:19.440Z', null, null, 'foreigner-the-bell-auditorium-2026-09-20');
    insert.run(381, null, '2026-09-20 02:48:58', null, null);
    insert.run(387, '', '2026-09-20 15:16:39', 'foreigner-the-bell-auditorium-2026-09-20', 'foreigner-the-bell-auditorium-2026-09-20');
    insert.run(300, '2026-07-25T01:00:00.000Z', null, 'jambase:15668773', 'jambase:15668773');
    // Force a different event title so Phish does not collide with Foreigner grouping.
    db.prepare(`UPDATE clips SET event_title = 'Phish at Madison Square Garden', artist_name = 'Phish', venue_name = 'Madison Square Garden' WHERE id = 300`).run();

    const rows = db
      .prepare(`
        SELECT ${groupedPastShowsSelectSql()}
        FROM clips
        GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
        ORDER BY artist_name ASC, show_date ASC
      `)
      .all() as Array<{ show_id: string; clip_count: number; artist_name: string; jambase_event_id: string | null }>;

    expect(
      rows.map((row) => ({
        show_id: row.show_id,
        clip_count: row.clip_count,
        artist_name: row.artist_name,
        jambase_event_id: row.jambase_event_id,
      })),
    ).toEqual([
      {
        show_id: 'jambase:15705118',
        clip_count: 6,
        artist_name: 'Foreigner',
        jambase_event_id: 'jambase:15705118',
      },
      {
        show_id: 'jambase:15668773',
        clip_count: 1,
        artist_name: 'Phish',
        jambase_event_id: 'jambase:15668773',
      },
    ]);
  });

  it('ignores Unix-epoch clip timestamps when dating a past-show card', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, created_at, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Hot Mulligan', 'Central Park', '1970-01-01T00:00:00.000Z', '2026-09-19T16:00:00.000Z', 'jambase:sk', 'jambase:sk', 'Shaky Knees Festival')
    `).run();

    const rows = db
      .prepare(
        `SELECT ${groupedPastShowsSelectSql()}
         FROM clips
         GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}`,
      )
      .all() as Array<{ show_date: string | null; event_title: string | null }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_title).toBe('Shaky Knees Festival');
    expect(rows[0]?.show_date).toBe('2026-09-19T16:00:00.000Z');
  });

  it('prefers a real clip poster over empty thumbnail strings', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title, thumbnail_url, stream_thumbnail_url)
      VALUES
        (1, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:1', 'jambase:1', 'Phish at MSG', '', NULL),
        (2, 'Phish', 'Madison Square Garden', '2026-07-25T02:00:00.000Z', 'jambase:1', 'jambase:1', 'Phish at MSG', NULL, 'https://videodelivery.net/abc/thumbnails/thumbnail.jpg?time=1s')
    `).run();

    const rows = db
      .prepare(
        `SELECT ${groupedPastShowsSelectSql()}
         FROM clips
         GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}`,
      )
      .all() as Array<{ thumbnail_url: string | null }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.thumbnail_url).toBe(
      'https://videodelivery.net/abc/thumbnails/thumbnail.jpg?time=1s',
    );
  });
});

describe('D1 statement length', () => {
  it('keeps show-page queries under the 100 KB D1 limit', () => {
    const showPage = withShowClipMembership(`
      SELECT clips.*, user_profiles.display_name as user_display_name
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE ${clipBelongsToRequestedShowSql()}
      AND clips.is_hidden = 0 AND clips.is_draft = 0
      ORDER BY clips.created_at DESC
      LIMIT ? OFFSET ?
    `);
    const pastShows = `
      SELECT ${groupedPastShowsSelectSql()}
      FROM clips
      WHERE clips.artist_name = ?
      GROUP BY ${CLIP_PAST_SHOW_GROUP_KEY_SQL}
      ORDER BY show_date DESC
      LIMIT ?
    `;
    const festivalPage = `
      SELECT clips.*
      FROM clips
      WHERE ${festivalClipSearchSql({
        titleNeedleCount: 4,
        eventIdCount: 80,
        editionYear: '2026',
      })}
      ORDER BY clips.created_at DESC
      LIMIT 50
    `;
    expect(showPage.length).toBeLessThan(D1_MAX_SQL_STATEMENT_BYTES);
    expect(pastShows.length).toBeLessThan(D1_MAX_SQL_STATEMENT_BYTES);
    expect(festivalPage.length).toBeLessThan(D1_MAX_SQL_STATEMENT_BYTES);
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
        created_at TEXT,
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
      VALUES (?, 'Phish', ?, ?, ?, ?, ?)
    `);
    insert.run(1, 'Madison Square Garden', '2025-04-20T01:00:00.000Z', 'jambase:123', 'phish-msg-2025-04-20', 'Phish at Madison Square Garden');
    insert.run(2, 'Madison Square Garden', '2025-04-20T03:00:00.000Z', 'jambase:123', 'jambase:123', 'Phish');
    insert.run(3, 'The Sphere', '2025-04-20T01:00:00.000Z', 'jambase:999', 'other-show', 'Other Night');

    const sql = withShowClipMembership(`SELECT id FROM clips WHERE ${clipBelongsToRequestedShowSql()} ORDER BY id`);
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

  it('includes same-night clips that never stored a JamBase event id', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (127, 'Ariana Grande', 'Barclays Center', '2026-07-14T00:44:57.227Z', 'jambase:14852021', 'jambase:14852021', 'Ariana Grande at Barclays Center'),
        (128, 'Ariana Grande', 'Barclays Center', '2026-07-14T02:32:25.797Z', 'jambase:14852021', 'jambase:14852021', 'Ariana Grande at Barclays Center'),
        (130, 'Ariana Grande', 'Barclays Center', '2026-07-14T02:47:04.993Z', 'jambase:14852021', 'jambase:14852021', 'Ariana Grande at Barclays Center'),
        (131, 'Ariana Grande', 'Barclays Center', '2026-07-14T00:32:47.000Z', NULL, 'ariana-grande-barclays-center-2026-07-14', 'Ariana Grande at Barclays Center')
    `).run();

    const sql = withShowClipMembership(`SELECT id FROM clips WHERE ${clipBelongsToRequestedShowSql()} ORDER BY id`);
    const byEventId = db
      .prepare(sql)
      .all(
        ...Array.from({ length: CLIP_BELONGS_TO_SHOW_BIND_COUNT }, () => 'jambase:14852021'),
      ) as Array<{ id: number }>;
    const byComposite = db
      .prepare(sql)
      .all(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'ariana-grande-barclays-center-2026-07-14',
        ),
      ) as Array<{ id: number }>;

    expect(byEventId).toEqual([{ id: 127 }, { id: 128 }, { id: 130 }, { id: 131 }]);
    expect(byComposite).toEqual([{ id: 127 }, { id: 128 }, { id: 130 }, { id: 131 }]);

    const canonicalBySlug = db
      .prepare(
        withShowClipMembership(`SELECT ${groupedPastShowIdSql()} as canonical_show_id
         FROM clips
         WHERE ${clipBelongsToRequestedShowSql()}`),
      )
      .get(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'ariana-grande-barclays-center-2026-07-14',
        ),
      ) as { canonical_show_id: string };
    expect(canonicalBySlug.canonical_show_id).toBe('jambase:14852021');
  });

  it('treats a UTC-midnight spill as one show page for the same billed title', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Foreigner', 'The Bell Auditorium', '2026-09-19T23:43:35.989Z', 'jambase:15705118', 'jambase:15705118', 'Foreigner at The Bell Auditorium'),
        (2, 'Foreigner', 'The Bell Auditorium', '2026-09-20T00:13:03.119Z', NULL, 'foreigner-the-bell-auditorium-2026-09-20', 'Foreigner at The Bell Auditorium')
    `).run();

    const sql = withShowClipMembership(`SELECT id FROM clips WHERE ${clipBelongsToRequestedShowSql()} ORDER BY id`);
    const byEventId = db
      .prepare(sql)
      .all(
        ...Array.from({ length: CLIP_BELONGS_TO_SHOW_BIND_COUNT }, () => 'jambase:15705118'),
      ) as Array<{ id: number }>;
    const byComposite = db
      .prepare(sql)
      .all(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'foreigner-the-bell-auditorium-2026-09-20',
        ),
      ) as Array<{ id: number }>;

    expect(byEventId).toEqual([{ id: 1 }, { id: 2 }]);
    expect(byComposite).toEqual([{ id: 1 }, { id: 2 }]);

    const canonicalBySlug = db
      .prepare(
        withShowClipMembership(`SELECT ${groupedPastShowIdSql()} as canonical_show_id
         FROM clips
         WHERE ${clipBelongsToRequestedShowSql()}`),
      )
      .get(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'foreigner-the-bell-auditorium-2026-09-20',
        ),
      ) as { canonical_show_id: string };
    expect(canonicalBySlug.canonical_show_id).toBe('jambase:15705118');
  });

  it('keeps a slug wrongly stored as jambase_event_id on the same Foreigner show page', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, created_at, jambase_event_id, show_id, event_title)
      VALUES
        (1, 'Foreigner', 'The Bell Auditorium', '2026-09-19T23:43:35.989Z', NULL, 'jambase:15705118', 'jambase:15705118', 'Foreigner at The Bell Auditorium'),
        (2, 'Foreigner', 'The Bell Auditorium', '2026-09-20T00:13:03.119Z', NULL, NULL, 'foreigner-the-bell-auditorium-2026-09-20', 'Foreigner at The Bell Auditorium'),
        (3, 'Foreigner', 'The Bell Auditorium', '', '2026-09-20 15:16:39', 'foreigner-the-bell-auditorium-2026-09-20', 'foreigner-the-bell-auditorium-2026-09-20', 'Foreigner at The Bell Auditorium')
    `).run();

    const sql = withShowClipMembership(`SELECT id FROM clips WHERE ${clipBelongsToRequestedShowSql()} ORDER BY id`);
    const byEventId = db
      .prepare(sql)
      .all(
        ...Array.from({ length: CLIP_BELONGS_TO_SHOW_BIND_COUNT }, () => 'jambase:15705118'),
      ) as Array<{ id: number }>;
    const byComposite = db
      .prepare(sql)
      .all(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'foreigner-the-bell-auditorium-2026-09-20',
        ),
      ) as Array<{ id: number }>;

    expect(byEventId).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(byComposite).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('includes archival clips that share an event title across capture days', () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO clips
        (id, artist_name, venue_name, timestamp, jambase_event_id, show_id, event_title)
      VALUES
        (27, 'Charlie Puth', 'Madison Square Garden', '2026-06-01T18:31:45.000Z', NULL, 'charlie-puth-madison-square-garden-2026-06-01', 'Charlie Puth at Madison Square Garden'),
        (28, 'Charlie Puth', 'Madison Square Garden', '2026-06-01T21:06:32.000Z', NULL, 'charlie-puth-madison-square-garden-2026-06-01', 'Charlie Puth at Madison Square Garden'),
        (36, 'Charlie Puth', 'Madison Square Garden', '2026-05-30T02:33:49.000Z', NULL, 'charlie-puth-madison-square-garden-2026-05-30', 'Charlie Puth at Madison Square Garden'),
        (300, 'Phish', 'Madison Square Garden', '2026-07-25T01:00:00.000Z', 'jambase:15668773', 'jambase:15668773', 'Phish at Madison Square Garden')
    `).run();

    const sql = withShowClipMembership(`SELECT id FROM clips WHERE ${clipBelongsToRequestedShowSql()} ORDER BY id`);
    const byJune = db
      .prepare(sql)
      .all(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'charlie-puth-madison-square-garden-2026-06-01',
        ),
      ) as Array<{ id: number }>;
    const byMay = db
      .prepare(sql)
      .all(
        ...Array.from(
          { length: CLIP_BELONGS_TO_SHOW_BIND_COUNT },
          () => 'charlie-puth-madison-square-garden-2026-05-30',
        ),
      ) as Array<{ id: number }>;
    const byPhishNight = db
      .prepare(sql)
      .all(
        ...Array.from({ length: CLIP_BELONGS_TO_SHOW_BIND_COUNT }, () => 'jambase:15668773'),
      ) as Array<{ id: number }>;

    expect(byJune).toEqual([{ id: 27 }, { id: 28 }, { id: 36 }]);
    expect(byMay).toEqual([{ id: 27 }, { id: 28 }, { id: 36 }]);
    expect(byPhishNight).toEqual([{ id: 300 }]);
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

  it('keeps clips from a show in the last 30 days and drops older shows', () => {
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
      `INSERT INTO jambase_events (jambase_event_id, start_date) VALUES (?, datetime('now', '-10 days'))`,
    ).run('jambase:fresh');
    db.prepare(
      `INSERT INTO jambase_events (jambase_event_id, start_date) VALUES (?, datetime('now', '-40 days'))`,
    ).run('jambase:stale');
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now', '-10 days'), datetime('now'), 'jambase:fresh')`,
    ).run();
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (2, datetime('now', '-40 days'), datetime('now'), 'jambase:stale')`,
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

  it('keeps unmatched clips whose recording time is older than 30 days', () => {
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
       VALUES (1, datetime('now', '-40 days'), datetime('now'), NULL)`,
    ).run();
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (2, ?, datetime('now'), NULL)`,
    ).run(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString());

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

  it('keeps a just-uploaded clip tagged to a show from 10 days ago', () => {
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
    ).run('jambase:past-show', new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString());
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now', '-10 days'), datetime('now'), 'jambase:past-show')`,
    ).run();

    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_SQL}`,
      )
      .all() as Array<{ id: number }>;

    expect(rows).toEqual([{ id: 1 }]);
  });

  it('drops a just-uploaded clip tagged to a show older than 30 days', () => {
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
    ).run('jambase:old-show', new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString());
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id)
       VALUES (1, datetime('now', '-40 days'), datetime('now'), 'jambase:old-show')`,
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

  it('keeps a tagged clip whose capture time is Unix epoch when the event row is missing', () => {
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
       VALUES (1, '1970-01-01T00:00:00.000Z', datetime('now'), 'festival-missing-row')`,
    ).run();

    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${LATEST_SCENE_CLIP_FRESH_SQL}`,
      )
      .all() as Array<{ id: number }>;

    expect(rows).toEqual([{ id: 1 }]);
  });

  it('keeps the viewer\'s own tagged clip in Latest even when the show is older than 30 days', () => {
    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(`
      CREATE TABLE clips (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        created_at TEXT,
        jambase_event_id TEXT,
        mocha_user_id TEXT
      );
      CREATE TABLE jambase_events (
        jambase_event_id TEXT PRIMARY KEY,
        start_date TEXT
      );
    `);
    db.prepare(
      `INSERT INTO jambase_events (jambase_event_id, start_date) VALUES (?, ?)`,
    ).run('jambase:old-show', new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString());
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id, mocha_user_id)
       VALUES (1, datetime('now', '-40 days'), datetime('now'), 'jambase:old-show', 'me')`,
    ).run();
    db.prepare(
      `INSERT INTO clips (id, timestamp, created_at, jambase_event_id, mocha_user_id)
       VALUES (2, datetime('now', '-40 days'), datetime('now'), 'jambase:old-show', 'someone-else')`,
    ).run();

    const latest = latestSceneClipFreshOrOwnSql('me');
    const rows = db
      .prepare(
        `SELECT clips.id FROM clips
         LEFT JOIN jambase_events latest_scene_ev
           ON latest_scene_ev.jambase_event_id = clips.jambase_event_id
         WHERE ${latest.sql}
         ORDER BY clips.id`,
      )
      .all(...latest.binds) as Array<{ id: number }>;

    expect(rows).toEqual([{ id: 1 }]);
  });
});

describe('mergeClipAndLibraryPastShows', () => {
  it('keeps clip cards and drops library stubs for the same night', () => {
    const merged = mergeClipAndLibraryPastShows(
      [
        {
          show_id: 'jambase:1',
          event_title: 'Phish at MSG',
          artist_name: 'Phish',
          show_date: '2024-07-14T20:00:00',
          venue_name: "Madison Square Garden",
          venue_location: 'New York, NY',
          jambase_event_id: 'jambase:1',
          jambase_venue_id: null,
          jambase_artist_id: null,
          clip_count: 3,
          thumbnail_url: 'https://cdn.example/a.jpg',
        },
      ],
      [
        {
          show_id: 'jambase:1',
          event_title: 'Phish at MSG',
          artist_name: 'Phish',
          show_date: '2024-07-14T20:00:00',
          venue_name: "Madison Square Garden",
          venue_location: 'New York, NY',
          jambase_event_id: 'jambase:1',
          jambase_venue_id: null,
          jambase_artist_id: null,
          clip_count: 0,
          thumbnail_url: 'https://cdn.example/stub.jpg',
        },
        {
          show_id: 'jambase:2',
          event_title: 'Phish at The Mann',
          artist_name: 'Phish',
          show_date: '2023-07-14T20:00:00',
          venue_name: 'The Mann',
          venue_location: 'Philadelphia, PA',
          jambase_event_id: 'jambase:2',
          jambase_venue_id: null,
          jambase_artist_id: null,
          clip_count: 0,
          thumbnail_url: null,
        },
      ],
      12,
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.jambase_event_id).toBe('jambase:1');
    expect(merged[0]?.clip_count).toBe(3);
    expect(merged[1]?.jambase_event_id).toBe('jambase:2');
  });

  it('drops a second null-JamBase card that only differs by capture day', () => {
    const merged = mergeClipAndLibraryPastShows(
      [
        {
          show_id: 'charlie-puth-madison-square-garden-2026-06-01',
          event_title: 'Charlie Puth at Madison Square Garden',
          artist_name: 'Charlie Puth',
          show_date: '2026-06-01T18:31:45.000Z',
          venue_name: 'Madison Square Garden',
          venue_location: 'New York, NY',
          jambase_event_id: null,
          jambase_venue_id: 'jambase:62108',
          jambase_artist_id: 'jambase:50343',
          clip_count: 2,
          thumbnail_url: 'https://cdn.example/a.jpg',
        },
        {
          show_id: 'charlie-puth-madison-square-garden-2026-05-30',
          event_title: 'Charlie Puth at Madison Square Garden',
          artist_name: 'Charlie Puth',
          show_date: '2026-05-30T02:33:49.000Z',
          venue_name: 'Madison Square Garden',
          venue_location: 'New York, NY',
          jambase_event_id: null,
          jambase_venue_id: 'jambase:62108',
          jambase_artist_id: 'jambase:50343',
          clip_count: 1,
          thumbnail_url: 'https://cdn.example/b.jpg',
        },
      ],
      [],
      12,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.show_id).toBe('charlie-puth-madison-square-garden-2026-06-01');
  });

  it('merges a JamBase card with a UTC-next-day composite card for the same billed show', () => {
    const merged = mergeClipAndLibraryPastShows(
      [
        {
          show_id: 'foreigner-the-bell-auditorium-2026-09-20',
          event_title: 'Foreigner at The Bell Auditorium',
          artist_name: 'Foreigner',
          show_date: '2026-09-20T00:13:03.119Z',
          venue_name: 'The Bell Auditorium',
          venue_location: 'Augusta, GA',
          jambase_event_id: null,
          jambase_venue_id: 'jambase:65079',
          jambase_artist_id: null,
          clip_count: 1,
          thumbnail_url: null,
        },
        {
          show_id: 'jambase:15705118',
          event_title: 'Foreigner at The Bell Auditorium',
          artist_name: 'Foreigner',
          show_date: '2026-09-19T23:43:35.989Z',
          venue_name: 'The Bell Auditorium',
          venue_location: 'Augusta, GA',
          jambase_event_id: 'jambase:15705118',
          jambase_venue_id: 'jambase:65079',
          jambase_artist_id: null,
          clip_count: 5,
          thumbnail_url: null,
        },
      ],
      [],
      12,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.jambase_event_id).toBe('jambase:15705118');
    expect(merged[0]?.clip_count).toBe(6);
  });

  it('keeps two-night residencies that have distinct JamBase event ids', () => {
    const merged = mergeClipAndLibraryPastShows(
      [
        {
          show_id: 'jambase:1',
          event_title: 'Phish at Madison Square Garden',
          artist_name: 'Phish',
          show_date: '2025-12-29T01:00:00.000Z',
          venue_name: 'Madison Square Garden',
          venue_location: 'New York, NY',
          jambase_event_id: 'jambase:1',
          jambase_venue_id: null,
          jambase_artist_id: null,
          clip_count: 2,
          thumbnail_url: null,
        },
        {
          show_id: 'jambase:2',
          event_title: 'Phish at Madison Square Garden',
          artist_name: 'Phish',
          show_date: '2025-12-30T01:00:00.000Z',
          venue_name: 'Madison Square Garden',
          venue_location: 'New York, NY',
          jambase_event_id: 'jambase:2',
          jambase_venue_id: null,
          jambase_artist_id: null,
          clip_count: 4,
          thumbnail_url: null,
        },
      ],
      [],
      12,
    );

    expect(merged).toHaveLength(2);
  });

  it('merges a second Jay-Z Yankee Stadium listing from the same night', () => {
    const merged = mergeClipAndLibraryPastShows(
      [
        showRow({
          show_id: 'jambase:old',
          event_title: 'Jay-Z at Yankee Stadium',
          artist_name: 'Jay-Z',
          show_date: '2024-07-14T23:10:00.000Z',
          venue_name: 'Yankee Stadium',
          jambase_event_id: 'jambase:old',
          clip_count: 4,
        }),
        showRow({
          show_id: 'jambase:new',
          event_title: 'Jay Z at Yankee Stadium',
          artist_name: 'Jay Z',
          show_date: '2024-07-14T23:40:00.000Z',
          venue_name: 'Yankee Stadium',
          jambase_event_id: 'jambase:new',
          clip_count: 2,
        }),
      ],
      [],
      12,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.clip_count).toBe(6);
    expect(merged[0]?.identity_ids).toEqual(expect.arrayContaining(['jambase:old', 'jambase:new']));
  });

  it('points an attended mark at the clip show id the player already uses', () => {
    expect(
      showPageIdForPastShowCard(
        showRow({
          show_id: 'jambase:mark',
          event_title: 'Jay-Z at Yankee Stadium',
          artist_name: 'Jay-Z',
          show_date: '2024-07-14T23:10:00.000Z',
          venue_name: 'Yankee Stadium',
          jambase_event_id: 'jambase:mark',
          clip_count: 0,
        }),
        [
          showRow({
            show_id: 'jambase:clips',
            event_title: 'Jay-Z at Yankee Stadium',
            artist_name: 'Jay-Z',
            show_date: '2024-07-14T23:40:00.000Z',
            venue_name: 'Yankee Stadium',
            jambase_event_id: 'jambase:clips',
            clip_count: 2,
          }),
        ],
      ),
    ).toEqual({ showId: 'jambase:clips', artistName: 'Jay-Z' });
  });

  it('merges a Jay-Z listing that crosses UTC midnight with the existing night', () => {
    expect(
      pastShowsAreSameConcert(
        showRow({
          show_id: 'jambase:old',
          event_title: 'Jay-Z at Yankee Stadium',
          artist_name: 'Jay-Z',
          show_date: '2024-07-14T23:40:00.000Z',
          venue_name: 'Yankee Stadium',
          jambase_event_id: 'jambase:old',
          clip_count: 4,
        }),
        showRow({
          show_id: 'jambase:new',
          event_title: 'Jay Z at Yankee Stadium',
          artist_name: 'Jay Z',
          show_date: '2024-07-15T00:20:00.000Z',
          venue_name: 'Yankee Stadium',
          jambase_event_id: 'jambase:new',
          clip_count: 2,
        }),
      ),
    ).toBe(true);
  });

  it('collapses festival day listings and a later upload in the same year', () => {
    const collapsed = collapsePastShowRows([
      showRow({
        show_id: 'jambase:sk-fri',
        event_title: 'Shaky Knees 2026 - Friday',
        artist_name: 'Foo Fighters',
        show_date: '2026-05-15T23:00:00.000Z',
        venue_name: 'Central Park',
        jambase_event_id: 'jambase:sk-fri',
        clip_count: 0,
      }),
      showRow({
        show_id: 'jambase:sk-sat',
        event_title: 'Shaky Knees 2026 - Saturday',
        artist_name: 'The National',
        show_date: '2026-09-22T18:00:00.000Z',
        venue_name: 'Central Park',
        jambase_event_id: 'jambase:sk-sat',
        clip_count: 0,
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(
      pastShowsAreSameConcert(
        collapsed[0]!,
        showRow({
          show_id: 'jambase:sk-2025',
          event_title: 'Shaky Knees',
          artist_name: 'Foo Fighters',
          show_date: '2025-09-19T23:00:00.000Z',
          venue_name: 'Central Park',
          jambase_event_id: 'jambase:sk-2025',
          clip_count: 1,
        }),
      ),
    ).toBe(false);
  });

  it('collapses a multi-day festival into one card and keeps a residency split', () => {
    const collapsed = collapsePastShowRows([
      showRow({
        show_id: 'jambase:sk-fri',
        event_title: 'Shaky Knees',
        artist_name: 'Foo Fighters',
        show_date: '2026-09-18T23:00:00.000Z',
        venue_name: 'Central Park',
        jambase_event_id: 'jambase:sk-fri',
        clip_count: 0,
      }),
      showRow({
        show_id: 'jambase:sk-sat',
        event_title: 'Shaky Knees Festival',
        artist_name: 'The National',
        show_date: '2026-09-19T23:00:00.000Z',
        venue_name: 'Central Park',
        jambase_event_id: 'jambase:sk-sat',
        clip_count: 0,
      }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(
      pickCanonicalShowIdentity(
        showRow({
          show_id: 'jambase:new',
          event_title: 'Jay Z at Yankee Stadium',
          artist_name: 'Jay Z',
          show_date: '2024-07-14T23:40:00.000Z',
          venue_name: 'Yankee Stadium',
          jambase_event_id: 'jambase:new',
          clip_count: 0,
        }),
        [
          showRow({
            show_id: 'jambase:old',
            event_title: 'Jay-Z at Yankee Stadium',
            artist_name: 'Jay-Z',
            show_date: '2024-07-14T23:10:00.000Z',
            venue_name: 'Yankee Stadium',
            jambase_event_id: 'jambase:old',
            clip_count: 4,
          }),
        ],
      )?.jambase_event_id,
    ).toBe('jambase:old');
    expect(pastShowsAreSameConcert(collapsed[0]!, showRow({
      show_id: 'performer-set',
      event_title: 'Shaky Knees 2026',
      artist_name: 'Foo Fighters',
      show_date: '2026-09-18T23:30:00.000Z',
      venue_name: 'Piedmont Park',
      jambase_event_id: 'performer-set',
      clip_count: 2,
    }))).toBe(true);
    expect(pastShowsAreSameConcert(collapsed[0]!, showRow({
      show_id: 'jambase:national',
      event_title: 'The National at Shaky Knees',
      artist_name: 'The National',
      show_date: '2026-09-19T23:00:00.000Z',
      venue_name: 'Piedmont Park',
      jambase_event_id: 'jambase:national',
      clip_count: 1,
    }))).toBe(true);
    expect(pastShowsAreSameConcert(
      showRow({
        show_id: 'jambase:coachella',
        event_title: 'Foo Fighters at Coachella',
        artist_name: 'Foo Fighters',
        show_date: '2026-04-12T23:00:00.000Z',
        venue_name: 'Empire Polo Club',
        jambase_event_id: 'jambase:coachella',
        clip_count: 1,
      }),
      showRow({
        show_id: 'jambase:sk',
        event_title: 'The National at Shaky Knees',
        artist_name: 'The National',
        show_date: '2026-09-19T23:00:00.000Z',
        venue_name: 'Piedmont Park',
        jambase_event_id: 'jambase:sk',
        clip_count: 1,
      }),
    )).toBe(false);
  });
});

function showRow(partial: Partial<PastShowListRow> & Pick<PastShowListRow, 'clip_count'>): PastShowListRow {
  return {
    show_id: partial.show_id ?? null,
    event_title: partial.event_title ?? null,
    artist_name: partial.artist_name ?? null,
    show_date: partial.show_date ?? null,
    venue_name: partial.venue_name ?? null,
    venue_location: partial.venue_location ?? null,
    jambase_event_id: partial.jambase_event_id ?? null,
    jambase_venue_id: partial.jambase_venue_id ?? null,
    jambase_artist_id: partial.jambase_artist_id ?? null,
    clip_count: partial.clip_count,
    thumbnail_url: partial.thumbnail_url ?? null,
    identity_ids: partial.identity_ids,
  };
}

describe('libraryShowNightKeySql', () => {
  it('matches the clip night key for the same artist, venue, and date', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE library_shows (
        jambase_event_id TEXT,
        artist_name TEXT,
        venue_name TEXT,
        start_date TEXT
      );
    `);
    db.prepare(
      `INSERT INTO library_shows (jambase_event_id, artist_name, venue_name, start_date)
       VALUES ('jambase:1', 'Phish', 'Madison Square Garden', '2024-07-14T20:00:00')`,
    ).run();
    const row = db
      .prepare(`SELECT ${libraryShowNightKeySql()} as night_key FROM library_shows`)
      .get() as { night_key: string };
    expect(row.night_key).toBe('phish|madison square garden|2024-07-14');
    db.close();
  });
});
