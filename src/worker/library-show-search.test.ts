import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { FEEDBACK_LIBRARY_SHOW_FLAG } from '../shared/library-shows';
import {
  LIBRARY_SHOW_SEARCH_SQL,
  LIBRARY_SHOW_STUB_SEARCH_SQL,
  libraryShowToJamBaseEvent,
  type LibraryShowSearchRow,
} from './library-show-search';

describe('library show search', () => {
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
        location TEXT,
        timestamp TEXT,
        jambase_event_id TEXT,
        jambase_venue_id TEXT,
        jambase_artist_id TEXT,
        show_id TEXT,
        event_title TEXT,
        thumbnail_url TEXT,
        stream_thumbnail_url TEXT,
        stream_video_id TEXT,
        is_hidden INTEGER DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        playback_unplayable INTEGER DEFAULT 0
      )
    `);
    return db;
  }

  it('finds past library shows by artist, venue, and title', () => {
    const db = createDb();
    db.prepare(
      `INSERT INTO clips
        (id, artist_name, venue_name, location, timestamp, jambase_event_id, show_id, event_title, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      1,
      'Phish',
      'Madison Square Garden',
      'New York, NY',
      '2024-12-31T01:00:00.000Z',
      'jambase:msg-nye',
      'phish-msg-2024-12-31',
      'Phish NYE',
      'https://cdn.example/nye.jpg',
    );
    db.prepare(
      `INSERT INTO clips
        (id, artist_name, venue_name, location, timestamp, jambase_event_id, show_id, event_title, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      2,
      'Goose',
      'The Capitol Theatre',
      'Port Chester, NY',
      '2024-11-01T01:00:00.000Z',
      null,
      'goose-cap-2024-11-01',
      'Goose at The Cap',
      null,
    );

    const phish = db
      .prepare(LIBRARY_SHOW_SEARCH_SQL)
      .all('%phish%', '%phish%', '%phish%', '%phish%', 10) as LibraryShowSearchRow[];
    expect(phish).toHaveLength(1);
    expect(phish[0]?.event_title).toBe('Phish NYE');
    expect(phish[0]?.clip_count).toBe(1);

    const garden = db
      .prepare(LIBRARY_SHOW_SEARCH_SQL)
      .all('%garden%', '%garden%', '%garden%', '%garden%', 10) as LibraryShowSearchRow[];
    expect(garden[0]?.venue_name).toBe('Madison Square Garden');

    const cap = db
      .prepare(LIBRARY_SHOW_SEARCH_SQL)
      .all('%the cap%', '%the cap%', '%the cap%', '%the cap%', 10) as LibraryShowSearchRow[];
    expect(cap[0]?.event_title).toBe('Goose at The Cap');
  });

  it('merges same-night library shows that used mixed JamBase and composite ids', () => {
    const db = createDb();
    db.prepare(
      `INSERT INTO clips
        (id, artist_name, venue_name, location, timestamp, jambase_event_id, show_id, event_title, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      1,
      'Ariana Grande',
      'Barclays Center',
      'Brooklyn, NY',
      '2026-07-14T00:44:57.227Z',
      'jambase:14852021',
      'jambase:14852021',
      'Ariana Grande at Barclays Center',
      'https://cdn.example/a.jpg',
    );
    db.prepare(
      `INSERT INTO clips
        (id, artist_name, venue_name, location, timestamp, jambase_event_id, show_id, event_title, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      2,
      'Ariana Grande',
      'Barclays Center',
      'New York, NY',
      '2026-07-14T00:32:47.000Z',
      null,
      'ariana-grande-barclays-center-2026-07-14',
      'Ariana Grande at Barclays Center',
      'https://cdn.example/b.jpg',
    );

    const ariana = db
      .prepare(LIBRARY_SHOW_SEARCH_SQL)
      .all('%ariana%', '%ariana%', '%ariana%', '%ariana%', 10) as LibraryShowSearchRow[];
    expect(ariana).toHaveLength(1);
    expect(ariana[0]?.show_id).toBe('jambase:14852021');
    expect(ariana[0]?.clip_count).toBe(2);
    expect(ariana[0]?.jambase_event_id).toBe('jambase:14852021');
  });

  it('maps a library show onto a Find a Show event row', () => {
    const event = libraryShowToJamBaseEvent({
      show_id: 'phish-msg-2024-12-31',
      event_title: 'Phish NYE',
      artist_name: 'Phish',
      show_date: '2024-12-31T01:00:00.000Z',
      venue_name: 'Madison Square Garden',
      venue_location: 'New York, NY',
      jambase_event_id: 'jambase:msg-nye',
      jambase_venue_id: 'venue-1',
      jambase_artist_id: 'artist-1',
      clip_count: 4,
      thumbnail_url: 'https://cdn.example/nye.jpg',
    });

    expect(event.identifier).toBe('jambase:msg-nye');
    expect(event[FEEDBACK_LIBRARY_SHOW_FLAG]).toBe(true);
    expect(event['x-feedbackShowId']).toBe('phish-msg-2024-12-31');
    expect(event['x-clipCount']).toBe(4);
    expect(event.name).toBe('Phish NYE');
  });

  it('finds user-added JamBase stubs without clips', () => {
    const db = createDb();
    db.exec(`
      CREATE TABLE library_shows (
        jambase_event_id TEXT PRIMARY KEY,
        artist_name TEXT,
        venue_name TEXT,
        venue_location TEXT,
        start_date TEXT,
        event_title TEXT,
        thumbnail_url TEXT,
        jambase_artist_id TEXT,
        jambase_venue_id TEXT
      )
    `);
    db.prepare(
      `INSERT INTO library_shows
        (jambase_event_id, artist_name, venue_name, venue_location, start_date, event_title, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'jambase:dead-sphere',
      'Dead & Company',
      'Sphere',
      'Las Vegas, NV',
      '2024-05-16T20:00:00',
      'Dead & Company at Sphere',
      'https://cdn.example/sphere.jpg',
    );

    const rows = db
      .prepare(LIBRARY_SHOW_STUB_SEARCH_SQL)
      .all('%sphere%', '%sphere%', '%sphere%', '%sphere%', 10) as LibraryShowSearchRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.show_id).toBe('jambase:dead-sphere');
    expect(rows[0]?.clip_count).toBe(0);
  });
});
