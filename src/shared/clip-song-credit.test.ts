import { describe, expect, it } from 'vitest';
import {
  clipShowsOpenerBadge,
  isSongTitleForced,
  songTitlesMatch,
} from './clip-song-credit';

describe('songTitlesMatch', () => {
  it('treats punctuation and case as the same title', () => {
    expect(songTitlesMatch("Sittin' Sidewayz", 'Sittin Sidewayz')).toBe(true);
    expect(songTitlesMatch('Purple Haze', 'All Along the Watchtower')).toBe(false);
  });
});

describe('clipShowsOpenerBadge', () => {
  it('marks a non-headliner fingerprint as Opener', () => {
    expect(
      clipShowsOpenerBadge({
        artist_name: 'Jimi Hendrix',
        recognized_song_artist: 'The Experience',
      }),
    ).toBe(true);
  });

  it('does not mark the headliner, including featured credits', () => {
    expect(
      clipShowsOpenerBadge({
        artist_name: 'Paul Wall',
        recognized_song_artist: 'Paul Wall feat. Chamillionaire',
      }),
    ).toBe(false);
  });

  it('does not mark when either name is missing', () => {
    expect(clipShowsOpenerBadge({ artist_name: 'Paul Wall', recognized_song_artist: null })).toBe(
      false,
    );
  });
});

describe('isSongTitleForced', () => {
  it('reads D1 0/1 flags', () => {
    expect(isSongTitleForced(1)).toBe(true);
    expect(isSongTitleForced(0)).toBe(false);
    expect(isSongTitleForced('1')).toBe(true);
  });
});
