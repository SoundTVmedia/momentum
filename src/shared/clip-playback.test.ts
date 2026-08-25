import { describe, expect, it } from 'vitest';
import {
  extractStreamVideoId,
  feedTileUsesStaticPoster,
  isHlsPlaybackUrl,
  resolveClipPosterCandidates,
  resolveClipPosterUrl,
  clipHasPlayableSource,
  clipHasPosterSource,
  clipShouldRenderInPublicFeed,
  filterPublicFeedClips,
  resolveClipDownloadFilename,
  resolveClipDownloadUrl,
  resolveFeedPreviewVideoSrc,
  resolveHlsPrefetchUrls,
  resolveModalPlaybackSource,
  resolveModalPrefetchPlan,
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

  it('prefers the confirmed stream MP4 for feed preview', () => {
    const src = resolveFeedPreviewVideoSrc({
      stream_video_id: UID,
      stream_mp4_url: `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`,
      stream_mp4_status: 'ready',
      video_url: `https://videodelivery.net/${UID}/manifest/video.m3u8`,
    });
    expect(src).toBe(`https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`);
  });

  it('never invents a downloads MP4 from a stream id alone', () => {
    // Cloudflare 404s /downloads/default.mp4 until that download is generated.
    const src = resolveFeedPreviewVideoSrc({
      stream_video_id: UID,
      video_url: `https://videodelivery.net/${UID}/manifest/video.m3u8`,
      r2_raw_key: 'clips/user/video/abc.mp4',
    });
    expect(src).not.toBe(streamMp4Url(UID));
    expect(src).toBe('/api/files/clips%2Fuser%2Fvideo%2Fabc.mp4');
  });

  it('ignores a stored MP4 whose generation has not finished', () => {
    const src = resolveFeedPreviewVideoSrc({
      stream_video_id: UID,
      stream_mp4_url: `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`,
      stream_mp4_status: 'inprogress',
      video_url: '/api/files/clips/x.mp4',
    });
    expect(src).toBe('/api/files/clips/x.mp4');
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

  it('prefetches only the confirmed Stream MP4 — never HLS — when MP4 will play', () => {
    const mp4 = `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`;
    expect(
      resolveModalPrefetchPlan({
        stream_video_id: UID,
        stream_mp4_url: mp4,
        stream_mp4_status: 'ready',
      }),
    ).toEqual({ progressiveUrl: mp4, hlsUrl: null });
  });

  it('prefetches HLS only when the Stream MP4 is not ready yet', () => {
    expect(resolveModalPrefetchPlan({ stream_video_id: UID })).toEqual({
      progressiveUrl: null,
      hlsUrl: `https://videodelivery.net/${UID}/manifest/video.m3u8`,
    });
  });

  it('uses the confirmed Stream MP4 first for modal, with HLS as fallback', () => {
    const mp4 = `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`;
    const modal = resolveModalPlaybackSource({
      stream_video_id: UID,
      stream_mp4_url: mp4,
      stream_mp4_status: 'ready',
      video_url: '/api/files/x.mp4',
    });
    expect(modal.isHls).toBe(false);
    expect(modal.src).toBe(mp4);
    expect(modal.streamVideoId).toBe(UID);
    expect(modal.hlsFallbackSrc).toBe(`https://videodelivery.net/${UID}/manifest/video.m3u8`);
    expect(streamVideoIdFromClip({ stream_video_id: UID })).toBe(UID);
  });

  it('plays a freshly ingested Stream clip over HLS until its MP4 exists', () => {
    const modal = resolveModalPlaybackSource({ stream_video_id: UID, video_url: '/api/files/x.mp4' });
    expect(modal.src).toBe(`https://videodelivery.net/${UID}/manifest/video.m3u8`);
    expect(modal.isHls).toBe(true);
    expect(modal.streamVideoId).toBe(UID);
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

  it('treats a Stream id as a playable source with generated posters', () => {
    expect(clipHasPlayableSource({ stream_video_id: UID })).toBe(true);
    expect(clipHasPosterSource({ stream_video_id: UID })).toBe(true);
    expect(clipShouldRenderInPublicFeed({ stream_video_id: UID })).toBe(true);
  });

  it('hides placeholder clips and worker-flagged unplayable rows from public feeds', () => {
    expect(clipShouldRenderInPublicFeed({ video_url: 'pending:upload' })).toBe(false);
    expect(
      clipShouldRenderInPublicFeed({
        stream_video_id: UID,
        playback_unplayable: 1,
      }),
    ).toBe(false);
    expect(
      filterPublicFeedClips([
        { stream_video_id: UID },
        { video_url: 'pending:upload' },
      ]),
    ).toHaveLength(1);
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

  it('resolves the confirmed stream MP4 for clip download', () => {
    const mp4 = `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`;
    expect(
      resolveClipDownloadUrl({
        stream_video_id: UID,
        stream_mp4_url: mp4,
        stream_mp4_status: 'ready',
      }),
    ).toBe(mp4);
  });

  it('downloads the R2 original when no Stream MP4 has been generated', () => {
    expect(
      resolveClipDownloadUrl({ stream_video_id: UID, r2_raw_key: 'clips/user/video/abc.mp4' }),
    ).toBe('/api/files/clips%2Fuser%2Fvideo%2Fabc.mp4');
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
