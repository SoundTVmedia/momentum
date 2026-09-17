import { describe, expect, it } from 'vitest';
import {
  canRunClipSongIdentify,
  clipNeedsSongIdentify,
  shouldAutoIdentifyClip,
} from './clip-song-identify';

const owner = { isOwner: true, isSuperadmin: false };
const superadmin = { isOwner: false, isSuperadmin: true };
const stranger = { isOwner: false, isSuperadmin: false };

describe('clipNeedsSongIdentify', () => {
  it('offers identify on any clip with no song, whatever the upload route', () => {
    // in-app camera, upload tab, drag-and-drop and URL import all land here as
    // a published row; only the missing song title matters.
    expect(clipNeedsSongIdentify({ song_title: null })).toBe(true);
    expect(clipNeedsSongIdentify({ song_title: '' })).toBe(true);
    expect(clipNeedsSongIdentify({ song_title: '   ' })).toBe(true);
    expect(clipNeedsSongIdentify({ song_title: null, content_feed: 'main' })).toBe(true);
    expect(clipNeedsSongIdentify({ song_title: null, content_feed: 'live' })).toBe(true);
  });

  it('hides identify once a song is attached', () => {
    expect(clipNeedsSongIdentify({ song_title: 'Tweezer' })).toBe(false);
  });

  it('skips friends-only pre/post clips, which carry no show association', () => {
    expect(clipNeedsSongIdentify({ song_title: null, content_feed: 'pre_post' })).toBe(false);
  });
});

describe('canRunClipSongIdentify', () => {
  it('allows the owner and a superadmin', () => {
    expect(canRunClipSongIdentify({ song_title: null }, owner)).toBe(true);
    expect(canRunClipSongIdentify({ song_title: null }, superadmin)).toBe(true);
  });

  it('denies everyone else, since the result is saved onto the clip', () => {
    expect(canRunClipSongIdentify({ song_title: null }, stranger)).toBe(false);
  });
});

describe('shouldAutoIdentifyClip', () => {
  it('auto-identifies only when the logged-in user posted the clip', () => {
    expect(shouldAutoIdentifyClip({ song_title: null }, owner)).toBe(true);
  });

  it('does not auto-identify other people’s clips, including for a superadmin', () => {
    expect(shouldAutoIdentifyClip({ song_title: null }, superadmin)).toBe(false);
    expect(shouldAutoIdentifyClip({ song_title: null }, stranger)).toBe(false);
  });

  it('skips auto-identify once a song is attached', () => {
    expect(shouldAutoIdentifyClip({ song_title: 'Tweezer' }, owner)).toBe(false);
  });
});
