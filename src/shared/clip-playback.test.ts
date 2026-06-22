import { describe, expect, it } from 'vitest';
import {
  extractStreamVideoId,
  feedTileUsesStaticPoster,
  isHlsPlaybackUrl,
  resolveClipPosterCandidates,
  resolveClipPosterUrl,
  resolveClipDownloadFilename,
  resolveClipDownloadUrl,
  resolveFeedPreviewVideoSrc,
  resolveHlsPrefetchUrls,
  resolveModalPlaybackSource,
  streamMp4Url,
  streamVideoIdFromClip,
} from './clip-playback';

const UID = 'a1b2c3d4e5f6789012345678abcdef01';

describe('clip-playback', () => {
  it('detects HLS URLs', () => {
    expect(isHlsPlaybackUrl(`https://videodelivery.net/${UID}/manifest/video.m3u8`)).toBe(true);
    expect(isHlsPlaybackUrl('/api/files/clips/foo.mp4')).toBe(false);
  });

  it('extracts stream id from playback URLs', () => {
    expect(extractStreamVideoId(`https://videodelivery.net/${UID}/manifest/video.m3u8`)).toBe(UID);
  });

  it('prefers stream MP4 for feed preview', () => {
    const src = resolveFeedPreviewVideoSrc({
      stream_video_id: UID,
      video_url: `https://videodelivery.net/${UID}/manifest/video.m3u8`,
    });
    expect(src).toBe(streamMp4Url(UID));
  });

  it('derives stream MP4 from HLS-only video_url when uid is embedded', () => {
    expect(
      resolveFeedPreviewVideoSrc({
        video_url: `https://videodelivery.net/${UID}/manifest/video.m3u8`,
      })
    ).toBe(streamMp4Url(UID));
  });

  it('returns R2 path for non-HLS fallback', () => {
    expect(resolveFeedPreviewVideoSrc({ video_url: '/api/files/clips/x.mp4' })).toBe(
      '/api/files/clips/x.mp4'
    );
  });

  it('ignores placeholder upload video URLs', () => {
    expect(resolveFeedPreviewVideoSrc({ video_url: 'pending:upload' })).toBeNull();
  });

  it('falls back to r2_raw_key when video_url is still a placeholder', () => {
    expect(
      resolveFeedPreviewVideoSrc({
        video_url: 'pending:upload',
        r2_raw_key: 'clips/user/video/abc.mp4',
      }),
    ).toBe('/api/files/clips%2Fuser%2Fvideo%2Fabc.mp4');
  });

  it('uses Stream MP4 first for modal when stream id present', () => {
    const modal = resolveModalPlaybackSource({ stream_video_id: UID, video_url: '/api/files/x.mp4' });
    expect(modal.isHls).toBe(false);
    expect(modal.src).toBe(streamMp4Url(UID));
    expect(modal.streamVideoId).toBe(UID);
    expect(modal.hlsFallbackSrc).toBe(`https://videodelivery.net/${UID}/manifest/video.m3u8`);
    expect(streamVideoIdFromClip({ stream_video_id: UID })).toBe(UID);
  });

  it('parses HLS media segment URLs from a manifest', () => {
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:2.0,
seg-0.ts
#EXTINF:2.0,
seg-1.ts`;
    expect(
      resolveHlsPrefetchUrls(manifest, `https://videodelivery.net/${UID}/manifest/video.m3u8`),
    ).toEqual([
      `https://videodelivery.net/${UID}/manifest/seg-0.ts`,
      `https://videodelivery.net/${UID}/manifest/seg-1.ts`,
    ]);
  });

  it('prefers uploaded JPEG poster over stream fields', () => {
    expect(
      resolveClipPosterUrl({
        thumbnail_url: '/api/files/clips/user/thumb.jpg',
        stream_video_id: UID,
      }),
    ).toBe('/api/files/clips/user/thumb.jpg');
  });

  it('skips HLS stream_thumbnail_url and uses Stream still frame at 1s', () => {
    expect(
      resolveClipPosterUrl({
        stream_thumbnail_url: `https://videodelivery.net/${UID}/manifest/video.m3u8`,
        stream_video_id: UID,
      }),
    ).toBe(`https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=1s&height=720`);
  });

  it('lists poster candidates: upload JPEG then stream times only', () => {
    expect(
      resolveClipPosterCandidates({
        thumbnail_url: '/api/files/clips/user/thumb.jpg',
        stream_video_id: UID,
      }),
    ).toEqual([
      '/api/files/clips/user/thumb.jpg',
      `https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=1s&height=720`,
      `https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=3s&height=720`,
      `https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=5s&height=720`,
      `https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=8s&height=720`,
      `https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=12s&height=720`,
    ]);
  });

  it('returns empty string when no clip poster sources exist', () => {
    expect(resolveClipPosterUrl({ video_url: 'pending:upload' })).toBe('');
  });

  it('does not use progressive video URLs as poster images', () => {
    expect(
      resolveClipPosterUrl({
        thumbnail_url: '/api/files/clips/user/video.mp4',
        stream_video_id: UID,
      }),
    ).toBe(`https://videodelivery.net/${UID}/thumbnails/thumbnail.jpg?time=1s&height=720`);
  });

  it('feed tiles always use static poster mode', () => {
    expect(feedTileUsesStaticPoster({ video_url: '/api/files/x.mp4' })).toBe(true);
  });

  it('resolves stream MP4 for clip download', () => {
    expect(resolveClipDownloadUrl({ stream_video_id: UID })).toBe(streamMp4Url(UID));
  });

  it('builds a readable download filename from artist and venue', () => {
    expect(
      resolveClipDownloadFilename(
        { artist_name: 'Phish', venue_name: 'Madison Square Garden' },
        42,
      ),
    ).toBe('phish-madison-square-garden.mp4');
  });
});
