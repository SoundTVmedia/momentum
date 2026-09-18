import { describe, expect, it } from 'vitest';
import {
  SETLIST_SONG_SPACING_MS,
  clipTimestampFromSetlistOrder,
  setlistIndexForSongTitle,
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

describe('sortClipsBySetlistThenRecorded', () => {
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
