import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clipPlayerShazamKitMediaUrl,
  identifyCacheFileName,
  identifySongForUploadedClip,
} from './identifySongForUploadedClip';
import { streamMp4Url, type ClipPlaybackFields } from '@/shared/clip-playback';
import * as shazamKitIdentify from '@/react-app/utils/shazamKitIdentify';

function clip(fields: Record<string, unknown>): ClipPlaybackFields {
  return fields as ClipPlaybackFields;
}

describe('clipPlayerShazamKitMediaUrl', () => {
  it('returns the Stream progressive MP4 for native ShazamKit', () => {
    expect(clipPlayerShazamKitMediaUrl(clip({ stream_video_id: 'abc123def456abc123def456abc123de' }))).toBe(
      streamMp4Url('abc123def456abc123def456abc123de'),
    );
  });

  it('falls back to a published progressive video_url when Stream is missing', () => {
    expect(clipPlayerShazamKitMediaUrl(clip({ video_url: 'https://cdn.example.com/clip.mp4' }))).toBe(
      'https://cdn.example.com/clip.mp4',
    );
  });

  it('falls back to the R2 file path when video_url is still a placeholder', () => {
    expect(
      clipPlayerShazamKitMediaUrl(
        clip({ video_url: 'pending:upload', r2_raw_key: 'clips/user/video/abc.mp4' }),
      ),
    ).toBe('/api/files/clips%2Fuser%2Fvideo%2Fabc.mp4');
  });
});

describe('identifyCacheFileName', () => {
  it('keeps Photos library .mov and defaults unknown URLs to .mp4', () => {
    expect(
      identifyCacheFileName(136, 'https://cdn.example.com/api/files/clips%2Fuser%2Fvideo%2FIMG_4016.mov'),
    ).toBe('clip-136.mov');
    expect(identifyCacheFileName(1, 'https://cdn.example.com/clip.m4v')).toBe('clip-1.m4v');
    expect(identifyCacheFileName(2, 'https://cdn.example.com/clip')).toBe('clip-2.mp4');
  });
});

describe('identifySongForUploadedClip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs identify-own-song and does not Range-fetch the published MP4', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/clips/identify-own-song');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        clipId: 42,
        streamVideoId: 'vid_1',
      });
      return new Response(
        JSON.stringify({
          ok: true,
          match: { artist: 'Olivia Dean', title: 'Be My Own Boyfriend', confidence: 90 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await identifySongForUploadedClip(
      clip({
        id: 42,
        stream_video_id: 'vid_1',
        video_url: 'https://cdn.example.com/clip.mp4',
      }),
    );

    expect(result).toMatchObject({
      status: 'match',
      artist: 'Olivia Dean',
      title: 'Be My Own Boyfriend',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a worker no-match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, match: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const result = await identifySongForUploadedClip(clip({ id: 7 }));
    expect(result.status).toBe('nomatch');
  });

  it('maps HTTP 429 as a retryable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'rate limited' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const result = await identifySongForUploadedClip(clip({ id: 9 }));
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/too many/i);
  });

  it('does not call the worker after a native full-file no-match', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'nomatch',
      message: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await identifySongForUploadedClip(
      clip({
        id: 136,
        video_url: 'https://cdn.example.com/IMG_4016.mov',
      }),
    );

    expect(result.status).toBe('nomatch');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(shazamKitIdentify.identifyNativeFileWithShazamKit).toHaveBeenCalledWith(
      'https://cdn.example.com/IMG_4016.mov',
      { scanWindows: true },
    );
  });

  it('falls back to the worker when ShazamKit errors', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'error',
      message: 'Could not read the clip audio.',
    });
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true, match: { artist: 'Jay-Z', title: '99 Problems' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await identifySongForUploadedClip(
      clip({
        id: 137,
        video_url: 'https://cdn.example.com/IMG_4018.mov',
      }),
    );

    expect(result).toMatchObject({
      status: 'match',
      artist: 'Jay-Z',
      title: '99 Problems',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
