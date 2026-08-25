import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SONG_CLIPS_ORDER_BY_SQL } from './clip-order-by';

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
