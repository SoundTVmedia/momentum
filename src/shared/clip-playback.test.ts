import { describe, expect, it } from 'vitest';
import {
  extractStreamVideoId,
  isHlsPlaybackUrl,
  resolveFeedPreviewVideoSrc,
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

  it('uses HLS for modal when stream id present', () => {
    const modal = resolveModalPlaybackSource({ stream_video_id: UID, video_url: '/api/files/x.mp4' });
    expect(modal.isHls).toBe(true);
    expect(modal.streamVideoId).toBe(UID);
    expect(streamVideoIdFromClip({ stream_video_id: UID })).toBe(UID);
  });
});
