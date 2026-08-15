import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clipPlayerShazamKitMediaUrl,
  identifySongForUploadedClip,
} from './identifySongForUploadedClip';
import { streamMp4Url, type ClipPlaybackFields } from '@/shared/clip-playback';

function clip(fields: Record<string, unknown>): ClipPlaybackFields {
  return fields as ClipPlaybackFields;
}

describe('clipPlayerShazamKitMediaUrl', () => {
  it('returns the Stream progressive MP4 for native ShazamKit', () => {
    expect(clipPlayerShazamKitMediaUrl(clip({ stream_video_id: 'abc123def456abc123def456abc123de' }))).toBe(
      streamMp4Url('abc123def456abc123def456abc123de'),
    );
  });

  it('returns null when the clip has no Stream id', () => {
    expect(clipPlayerShazamKitMediaUrl(clip({ video_url: 'https://cdn.example.com/clip.mp4' }))).toBeNull();
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
});
