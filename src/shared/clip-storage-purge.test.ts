import { describe, expect, it } from 'vitest';
import { clipR2KeysForPurge, clipStreamVideoIdForPurge } from './clip-storage-purge';

describe('clipR2KeysForPurge', () => {
  it('collects the raw key and keys decoded from /api/files URLs', () => {
    expect(
      clipR2KeysForPurge({
        r2_raw_key: 'clips/user/video/clip.mp4',
        video_url: '/api/files/clips%2Fuser%2Fvideo%2Fclip.mp4',
        thumbnail_url: '/api/files/clips%2Fuser%2Fthumbnail%2Fposter.jpg',
        stream_thumbnail_url: 'https://videodelivery.net/abc/thumbnails/thumbnail.jpg',
      }),
    ).toEqual([
      'clips/user/video/clip.mp4',
      'clips/user/thumbnail/poster.jpg',
    ]);
  });

  it('ignores empty and Stream CDN playback URLs', () => {
    expect(
      clipR2KeysForPurge({
        r2_raw_key: null,
        video_url: 'https://videodelivery.net/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/manifest/video.m3u8',
        thumbnail_url: '',
      }),
    ).toEqual([]);
  });
});

describe('clipStreamVideoIdForPurge', () => {
  it('prefers the stored Stream uid', () => {
    expect(
      clipStreamVideoIdForPurge({
        stream_video_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        video_url: '/api/files/clips/user/video/clip.mp4',
      }),
    ).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('falls back to a Stream playback URL', () => {
    expect(
      clipStreamVideoIdForPurge({
        stream_video_id: null,
        stream_playback_url:
          'https://videodelivery.net/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/manifest/video.m3u8',
      }),
    ).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });
});
