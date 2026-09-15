import { describe, expect, it } from 'vitest';
import {
  jamBaseEventSetlist,
  jamBaseEventSetlistUrl,
  parseStoredSetlist,
  serializeStoredSetlist,
} from './jambase-setlist';

describe('jamBaseEventSetlist', () => {
  it('reads workPerformed songs', () => {
    const songs = jamBaseEventSetlist({
      workPerformed: [
        { name: 'Tweezer', byArtist: { name: 'Phish' } },
        { title: 'You Enjoy Myself' },
      ],
    });
    expect(songs).toEqual([
      { title: 'Tweezer', artist: 'Phish' },
      { title: 'You Enjoy Myself' },
    ]);
  });

  it('reads nested setlist.fm-style sets', () => {
    const songs = jamBaseEventSetlist({
      setlist: [{ set: [{ song: { name: 'Wilson' } }, { song: 'Possum' }] }],
    });
    expect(songs.map((s) => s.title)).toEqual(['Wilson', 'Possum']);
  });

  it('returns an empty list when JamBase omitted songs', () => {
    expect(jamBaseEventSetlist({ name: 'Phish at MSG' })).toEqual([]);
  });
});

describe('jamBaseEventSetlistUrl', () => {
  it('finds a setlist.fm sameAs link', () => {
    expect(
      jamBaseEventSetlistUrl({
        sameAs: [{ url: 'https://www.setlist.fm/setlist/phish/2024/madison-square-garden.html' }],
      }),
    ).toContain('setlist.fm');
  });
});

describe('stored setlist JSON', () => {
  it('round-trips songs and a setlist.fm url', () => {
    const json = serializeStoredSetlist({
      workPerformed: [{ name: 'Tweezer' }],
      sameAs: [{ url: 'https://www.setlist.fm/setlist/phish/2024/msg.html' }],
    });
    const stored = parseStoredSetlist(json);
    expect(stored.songs).toEqual([{ title: 'Tweezer' }]);
    expect(stored.url).toContain('setlist.fm');
  });

  it('reads the legacy library_shows array shape', () => {
    expect(parseStoredSetlist(JSON.stringify([{ title: 'Possum' }])).songs).toEqual([
      { title: 'Possum' },
    ]);
  });
});
