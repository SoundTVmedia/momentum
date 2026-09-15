import { describe, expect, it } from 'vitest';
import { mixFindAShowArchiveFirst, mixFindAShowEvents } from './jambase-events-search';

function ev(id: string, startDate: string): Record<string, unknown> {
  return { identifier: id, startDate };
}

describe('mixFindAShowEvents', () => {
  const nowMs = Date.parse('2026-06-14T16:00:00.000Z');
  const past = Array.from({ length: 20 }, (_, i) =>
    ev(`past-${i}`, `2026-05-${String(20 - (i % 10)).padStart(2, '0')}T20:00:00`),
  );
  const upcoming = Array.from({ length: 20 }, (_, i) =>
    ev(`up-${i}`, `2026-07-${String(i + 1).padStart(2, '0')}T20:00:00`),
  );

  it('lists past first and keeps more past than upcoming when both exist', () => {
    const mixed = mixFindAShowEvents([...upcoming, ...past], 24, nowMs);
    expect(mixed).toHaveLength(24);
    const pastIds = mixed.filter((e) => String(e.identifier).startsWith('past-'));
    const upIds = mixed.filter((e) => String(e.identifier).startsWith('up-'));
    expect(pastIds).toHaveLength(18);
    expect(upIds).toHaveLength(6);
    expect(mixed.slice(0, 18).every((e) => String(e.identifier).startsWith('past-'))).toBe(true);
  });

  it('fills leftover slots with upcoming when past is short', () => {
    const mixed = mixFindAShowEvents([...upcoming, ...past.slice(0, 2)], 24, nowMs);
    expect(mixed[0]?.identifier).toBe('past-0');
    expect(mixed.filter((e) => String(e.identifier).startsWith('past-'))).toHaveLength(2);
    expect(mixed.filter((e) => String(e.identifier).startsWith('up-'))).toHaveLength(20);
    expect(mixed).toHaveLength(22);
  });

  it('returns only upcoming when there is no past', () => {
    const mixed = mixFindAShowEvents(upcoming, 10, nowMs);
    expect(mixed).toHaveLength(10);
    expect(mixed.every((e) => String(e.identifier).startsWith('up-'))).toBe(true);
  });
});

describe('mixFindAShowArchiveFirst', () => {
  const nowMs = Date.parse('2026-06-14T16:00:00.000Z');

  it('puts JamBase archive nights ahead of library-only nights when both fit', () => {
    const mixed = mixFindAShowArchiveFirst(
      [ev('jb-1', '2026-05-20T20:00:00'), ev('jb-2', '2026-05-18T20:00:00')],
      [ev('lib-1', '2026-05-22T20:00:00'), ev('jb-1', '2026-05-20T20:00:00')],
      [ev('up-1', '2026-07-01T20:00:00')],
      8,
      nowMs,
    );
    expect(mixed.map((e) => e.identifier)).toEqual(['lib-1', 'jb-1', 'jb-2', 'up-1']);
  });

  it('reserves past slots for in-app library shows when JamBase fills the archive', () => {
    const jam = Array.from({ length: 30 }, (_, i) =>
      ev(`jb-${i}`, `2026-05-${String(20 - (i % 10)).padStart(2, '0')}T20:00:00`),
    );
    const library = [
      ev('lib-msg', '2026-05-28T20:00:00'),
      ev('lib-sphere', '2026-04-18T20:00:00'),
    ];
    const mixed = mixFindAShowArchiveFirst(jam, library, [ev('up-1', '2026-07-01T20:00:00')], 24, nowMs);
    const ids = mixed.map((e) => String(e.identifier));
    expect(ids).toContain('lib-msg');
    expect(ids).toContain('lib-sphere');
    expect(ids).toContain('up-1');
    expect(ids.filter((id) => id.startsWith('lib-')).length).toBeGreaterThanOrEqual(2);
  });
});
