import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SHOW_CLIPS_RECORDED_ORDER_BY_SQL, SONG_CLIPS_ORDER_BY_SQL, compareClipsByRecordedTimeAsc } from './clip-order-by';

type Row = { id: string };

/**
 * Runs the real ORDER BY against SQLite (the D1 engine) so the mixed
 * `timestamp` / `created_at` storage formats are exercised, not just asserted
 * about in a comment.
 */
function orderedIds(rows: Array<[string, string | null, string]>): string[] {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE clips (id TEXT, timestamp TEXT, created_at TEXT)');
  const insert = db.prepare('INSERT INTO clips VALUES (?, ?, ?)');
  for (const [id, timestamp, createdAt] of rows) insert.run(id, timestamp, createdAt);
  const out = db
    .prepare(`SELECT clips.id FROM clips ${SONG_CLIPS_ORDER_BY_SQL}`)
    .all() as Row[];
  db.close();
  return out.map((r) => r.id);
}

describe('SONG_CLIPS_ORDER_BY_SQL', () => {
  it('orders by when the clip was recorded, not when it was posted', () => {
    // "old-show" was filmed first but uploaded last; it must sort last.
    const ids = orderedIds([
      ['old-show', '2025-06-01T20:00:00.000Z', '2026-08-23 00:54:40'],
      ['new-show', '2026-08-22T01:25:38.211Z', '2026-01-02 00:00:00'],
      ['mid-show', '2026-02-10T03:00:00.000Z', '2026-01-01 00:00:00'],
    ]);
    expect(ids).toEqual(['new-show', 'mid-show', 'old-show']);
  });

  it('compares ISO capture times against SQLite created_at correctly', () => {
    // Raw string compare puts 'T' (0x54) after ' ' (0x20), which interleaved
    // the two storage formats. datetime() normalizes both before comparing.
    const ids = orderedIds([
      ['iso', '2026-08-22T01:25:38.211Z', '2026-08-23 00:54:40'],
      ['sqlite-format', '2026-08-22 06:00:00', '2026-08-23 00:00:00'],
    ]);
    expect(ids).toEqual(['sqlite-format', 'iso']);
  });

  it('falls back to the posted time when a row has no capture timestamp', () => {
    const ids = orderedIds([
      ['no-capture-recent', null, '2026-08-24 12:00:00'],
      ['captured-older', '2026-08-20T12:00:00.000Z', '2026-01-01 00:00:00'],
      ['blank-capture-oldest', '   ', '2026-01-05 00:00:00'],
    ]);
    expect(ids).toEqual(['no-capture-recent', 'captured-older', 'blank-capture-oldest']);
  });

  it('does not drop rows whose capture timestamp is unparseable', () => {
    const ids = orderedIds([
      ['garbage-capture', 'not-a-date', '2026-08-24 12:00:00'],
      ['good-capture', '2026-08-20T12:00:00.000Z', '2026-01-01 00:00:00'],
    ]);
    expect(ids).toHaveLength(2);
    expect(ids).toContain('garbage-capture');
  });
});

describe('SHOW_CLIPS_RECORDED_ORDER_BY_SQL', () => {
  it('orders show clips from oldest recorded to newest', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE clips (id TEXT, timestamp TEXT, created_at TEXT)');
    const insert = db.prepare('INSERT INTO clips VALUES (?, ?, ?)');
    insert.run('encore', '2026-08-22T03:00:00.000Z', '2026-01-01 00:00:00');
    insert.run('opener', '2026-08-22T01:00:00.000Z', '2026-08-24 12:00:00');
    insert.run('mid-set', '2026-08-22T02:00:00.000Z', '2026-08-23 00:00:00');
    const ids = (
      db.prepare(`SELECT clips.id FROM clips ${SHOW_CLIPS_RECORDED_ORDER_BY_SQL}`).all() as Array<{
        id: string;
      }>
    ).map((row) => row.id);
    db.close();
    expect(ids).toEqual(['opener', 'mid-set', 'encore']);
  });

  it('inserts a late upload by recorded time, not posted time', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE clips (id TEXT, timestamp TEXT, created_at TEXT)');
    const insert = db.prepare('INSERT INTO clips VALUES (?, ?, ?)');
    insert.run('encore', '2026-08-22T03:00:00.000Z', '2026-08-22 04:00:00');
    insert.run('opener', '2026-08-22T01:00:00.000Z', '2026-08-22 01:10:00');
    insert.run('late-mid-set', '2026-08-22T02:00:00.000Z', '2026-09-15 18:00:00');
    const ids = (
      db.prepare(`SELECT clips.id FROM clips ${SHOW_CLIPS_RECORDED_ORDER_BY_SQL}`).all() as Array<{
        id: string;
      }>
    ).map((row) => row.id);
    db.close();
    expect(ids).toEqual(['opener', 'late-mid-set', 'encore']);
  });
});

describe('compareClipsByRecordedTimeAsc', () => {
  it('orders a late upload among earlier clips by recorded time', () => {
    const clips = [
      { id: 'encore', timestamp: '2026-08-22T03:00:00.000Z', created_at: '2026-08-22 04:00:00' },
      { id: 'late-opener', timestamp: '2026-08-22T01:00:00.000Z', created_at: '2026-09-15 18:00:00' },
      { id: 'mid-set', timestamp: '2026-08-22T02:00:00.000Z', created_at: '2026-08-22 02:10:00' },
    ];
    expect(clips.sort(compareClipsByRecordedTimeAsc).map((c) => c.id)).toEqual([
      'late-opener',
      'mid-set',
      'encore',
    ]);
  });
});
