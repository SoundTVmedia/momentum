import { describe, expect, it } from 'vitest';
import {
  SETLIST_SONG_SPACING_MS,
  clipTimestampFromEventStart,
  clipTimestampFromSetlistOrder,
  setlistIndexForSongTitle,
  showNightRecordedAtIso,
  sortClipsBySetlistThenRecorded,
} from './clip-setlist-order';

const setlist = [
  { title: 'Wilson' },
  { title: 'Free' },
  { title: 'You Enjoy Myself' },
  { title: 'Tweezer Reprise' },
];

describe('setlistIndexForSongTitle', () => {
  it('prefers an exact title match over a substring', () => {
    expect(setlistIndexForSongTitle(setlist, 'Free')).toBe(1);
    expect(setlistIndexForSongTitle([{ title: 'Freedom' }, { title: 'Free' }], 'Free')).toBe(1);
  });

  it('falls back to a close display-name match', () => {
    expect(setlistIndexForSongTitle(setlist, 'you enjoy myself')).toBe(2);
  });

  it('returns null when the clip has no song or the setlist is empty', () => {
    expect(setlistIndexForSongTitle(setlist, '')).toBeNull();
    expect(setlistIndexForSongTitle([], 'Wilson')).toBeNull();
    expect(setlistIndexForSongTitle(setlist, 'Fluffhead')).toBeNull();
  });
});

describe('clipTimestampFromSetlistOrder', () => {
  it('places the clip on show night at its setlist index', () => {
    const start = '2024-07-14T20:00:00.000Z';
    expect(
      clipTimestampFromSetlistOrder({
        eventStartIso: start,
        setlist,
        songTitle: 'You Enjoy Myself',
      }),
    ).toBe(new Date(Date.parse(start) + 2 * SETLIST_SONG_SPACING_MS).toISOString());
  });

  it('returns null without a matching song or event start', () => {
    expect(
      clipTimestampFromSetlistOrder({
        eventStartIso: '2024-07-14T20:00:00.000Z',
        setlist,
        songTitle: '',
      }),
    ).toBeNull();
    expect(
      clipTimestampFromSetlistOrder({
        eventStartIso: null,
        setlist,
        songTitle: 'Wilson',
      }),
    ).toBeNull();
  });
});

describe('clipTimestampFromEventStart', () => {
  it('uses a date-only festival start when the clip has no capture time', () => {
    expect(clipTimestampFromEventStart('2026-09-18')).toBe('2026-09-18T12:00:00.000Z');
  });

  it('rejects Unix-epoch starts', () => {
    expect(clipTimestampFromEventStart('1970-01-01T00:00:00.000Z')).toBeNull();
  });
});

describe('sortClipsBySetlistThenRecorded', () => {
  it('inserts a late upload among recorded clips by capture time', () => {
    const ordered = sortClipsBySetlistThenRecorded(
      [
        {
          id: 'encore',
          song_title: 'Tweezer Reprise',
          timestamp: '2010-09-13T23:50:00.000Z',
          created_at: '2010-09-14 01:40:00',
        },
        {
          id: '99-late',
          song_title: '99 Problems',
          timestamp: '2010-09-13T23:22:00.000Z',
          created_at: '2026-09-18 12:00:00',
        },
        {
          id: '99-early',
          song_title: '99 Problems',
          timestamp: '2010-09-13T23:20:00.000Z',
          created_at: '2010-09-14 01:10:00',
        },
        {
          id: 'opener',
          song_title: 'Public Service Announcement',
          timestamp: '2010-09-13T23:05:00.000Z',
          created_at: '2010-09-14 01:00:00',
        },
      ],
      [
        { title: 'Public Service Announcement' },
        { title: '99 Problems' },
        { title: 'Tweezer Reprise' },
      ],
      '2010-09-13T20:00:00',
    );
    expect(ordered.map((clip) => clip.id)).toEqual(['opener', '99-early', '99-late', 'encore']);
  });

  it('uses recorded time even when that disagrees with setlist order', () => {
    const start = '2024-07-14T20:00:00.000Z';
    const ordered = sortClipsBySetlistThenRecorded(
      [
        {
          id: 'wilson-late',
          song_title: 'Wilson',
          timestamp: '2024-07-14T22:00:00.000Z',
          created_at: '2024-07-14 20:10:00',
        },
        {
          id: 'yem-early',
          song_title: 'You Enjoy Myself',
          timestamp: '2024-07-14T20:00:00.000Z',
          created_at: '2026-09-17 18:00:00',
        },
      ],
      setlist,
      start,
    );
    expect(ordered.map((clip) => clip.id)).toEqual(['yem-early', 'wilson-late']);
  });

  it('inserts a no-metadata clip by song title among recorded-time clips', () => {
    const start = '2024-07-14T20:00:00.000Z';
    const ordered = sortClipsBySetlistThenRecorded(
      [
        {
          id: 'encore',
          song_title: 'Tweezer Reprise',
          timestamp: '2024-07-14T22:30:00.000Z',
          created_at: '2024-07-14 22:40:00',
        },
        {
          id: 'late-free',
          song_title: 'Free',
          timestamp: '',
          created_at: '2026-09-17 18:00:00',
        },
        {
          id: 'opener',
          song_title: 'Wilson',
          timestamp: '2024-07-14T20:00:00.000Z',
          created_at: '2024-07-14 20:10:00',
        },
      ],
      setlist,
      start,
    );
    expect(ordered.map((clip) => clip.id)).toEqual(['opener', 'late-free', 'encore']);
  });

  it('uses setlist order when clips share the same recorded timestamp', () => {
    const start = '2010-09-13T20:00:00';
    const sameNight = '2010-09-13T00:00:00.000Z';
    const ordered = sortClipsBySetlistThenRecorded(
      [
        {
          id: '99',
          song_title: '99 Problems',
          timestamp: sameNight,
          created_at: '2026-09-18 12:00:00',
        },
        {
          id: 'encore',
          song_title: 'Encore',
          timestamp: sameNight,
          created_at: '2026-09-17 10:00:00',
        },
        {
          id: 'psa',
          song_title: 'Public Service Announcement',
          timestamp: sameNight,
          created_at: '2026-09-18 12:05:00',
        },
      ],
      [
        { title: 'Public Service Announcement' },
        { title: '99 Problems' },
        { title: 'Encore' },
      ],
      start,
    );
    expect(ordered.map((clip) => clip.id)).toEqual(['psa', '99', 'encore']);
  });

  it('falls back to uploaded time when there is no recorded time and no setlist match', () => {
    const start = '2024-07-14T20:00:00.000Z';
    const ordered = sortClipsBySetlistThenRecorded(
      [
        {
          id: 'uploaded-last',
          song_title: '',
          timestamp: '',
          created_at: '2026-09-18 12:00:00',
        },
        {
          id: 'late-free',
          song_title: 'Free',
          timestamp: '',
          created_at: '2026-09-17 18:00:00',
        },
        {
          id: 'opener',
          song_title: 'Wilson',
          timestamp: '2024-07-14T20:00:00.000Z',
          created_at: '2024-07-14 20:10:00',
        },
      ],
      setlist,
      start,
    );
    expect(ordered.map((clip) => clip.id)).toEqual(['opener', 'late-free', 'uploaded-last']);
  });
});

describe('showNightRecordedAtIso', () => {
  const event = { startDate: '2024-07-14T20:00:00.000Z' };

  it('keeps a timestamp from show night', () => {
    expect(showNightRecordedAtIso('2024-07-14T20:05:00.000Z', event)).toBe(
      '2024-07-14T20:05:00.000Z',
    );
  });

  it('drops a library file date from another day', () => {
    expect(showNightRecordedAtIso('2026-09-18T12:00:00.000Z', event)).toBeNull();
  });

  it('keeps a July 13 after-midnight Yankee Stadium capture on a July 12 JamBase listing', () => {
    const yankee = {
      startDate: '2026-07-12T20:00:00',
      location: {
        name: 'Yankee Stadium',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    const recordedAt = '2026-07-13T05:03:33.000Z';
    expect(showNightRecordedAtIso(recordedAt, yankee)).toBe(recordedAt);
  });
});
