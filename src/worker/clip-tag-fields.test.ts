import { describe, expect, it } from 'vitest';
import { songCreditForClipUpdate } from './clip-tag-fields';

describe('songCreditForClipUpdate', () => {
  it('keeps existing credits when the save did not send them', () => {
    expect(
      songCreditForClipUpdate(
        { song_title: 'Manual' },
        {
          recognized_song_title: 'Purple Haze',
          recognized_song_artist: 'Jimi Hendrix',
          song_title_forced: 1,
        },
      ),
    ).toEqual({
      recognized_song_title: 'Purple Haze',
      recognized_song_artist: 'Jimi Hendrix',
      song_title_forced: 1,
    });
  });

  it('writes fingerprint credits when the client sends them', () => {
    expect(
      songCreditForClipUpdate(
        {
          recognized_song_title: 'Foxey Lady',
          recognized_song_artist: 'Jimi Hendrix',
          song_title_forced: 0,
        },
        { recognized_song_title: 'Old', recognized_song_artist: 'Old', song_title_forced: 1 },
      ),
    ).toEqual({
      recognized_song_title: 'Foxey Lady',
      recognized_song_artist: 'Jimi Hendrix',
      song_title_forced: 0,
    });
  });
});
