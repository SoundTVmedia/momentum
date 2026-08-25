import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clipPlayerShazamKitMediaUrl,
  identifyCacheFileName,
  identifySongForUploadedClip,
} from './identifySongForUploadedClip';
import { streamMp4Url, type ClipPlaybackFields } from '@/shared/clip-playback';
import type { AudDIdentifyResult } from '@/react-app/utils/auddIdentify';
import * as auddIdentify from '@/react-app/utils/auddIdentify';
import * as nativeBridge from '@/react-app/lib/native-bridge';
import * as shazamKitIdentify from '@/react-app/utils/shazamKitIdentify';
import { resetIdentifyMusicConfigCache } from '@/react-app/lib/identify-music-config';

function clip(fields: Record<string, unknown>): ClipPlaybackFields {
  return fields as ClipPlaybackFields;
}

const CONFIG_PATH = '/api/clips/identify-music/config';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Worker ACR config probe plus one handler for the real identify call. */
function fetchMockWithConfig(
  acrReady: boolean,
  handler?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes(CONFIG_PATH)) {
      return json({
        activeProvider: acrReady ? 'acrcloud' : 'none',
        acrcloud: { ready: acrReady },
        hint: acrReady ? null : 'not configured',
      });
    }
    if (handler) return handler(input, init);
    throw new Error(`unexpected fetch: ${String(input)}`);
  });
}

function identifyCalls() {
  return vi
    .mocked(shazamKitIdentify.identifyNativeFileWithShazamKit)
    .mock.calls.map((call) => call[1]);
}

describe('clipPlayerShazamKitMediaUrl', () => {
  const UID = 'abc123def456abc123def456abc123de';

  it('returns the Stream MP4 once Cloudflare has generated it', () => {
    const mp4 = `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`;
    expect(
      clipPlayerShazamKitMediaUrl(
        clip({ stream_video_id: UID, stream_mp4_url: mp4, stream_mp4_status: 'ready' }),
      ),
    ).toBe(mp4);
  });

  it('reads the R2 original rather than an ungenerated Stream MP4', () => {
    // /downloads/default.mp4 404s until generated; identify would have been
    // handed an error page instead of audio.
    const url = clipPlayerShazamKitMediaUrl(
      clip({ stream_video_id: UID, r2_raw_key: 'clips/user/video/abc.mp4' }),
    );
    expect(url).not.toBe(streamMp4Url(UID));
    expect(url).toBe('/api/files/clips%2Fuser%2Fvideo%2Fabc.mp4');
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
  beforeEach(() => {
    resetIdentifyMusicConfigCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs identify-own-song and does not Range-fetch the published MP4', async () => {
    const fetchMock = fetchMockWithConfig(true, async (input, init) => {
      expect(String(input)).toBe('/api/clips/identify-own-song');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ clipId: 42, streamVideoId: 'vid_1' });
      return json({
        ok: true,
        match: { artist: 'Olivia Dean', title: 'Be My Own Boyfriend', confidence: 90 },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await identifySongForUploadedClip(
      clip({ id: 42, stream_video_id: 'vid_1', video_url: 'https://cdn.example.com/clip.mp4' }),
    );

    expect(result).toMatchObject({
      status: 'match',
      artist: 'Olivia Dean',
      title: 'Be My Own Boyfriend',
    });
  });

  it('maps a worker no-match', async () => {
    vi.stubGlobal('fetch', fetchMockWithConfig(true, async () => json({ ok: true, match: null })));
    const result = await identifySongForUploadedClip(clip({ id: 7 }));
    expect(result.status).toBe('nomatch');
  });

  it('maps HTTP 429 as a retryable error', async () => {
    vi.stubGlobal(
      'fetch',
      fetchMockWithConfig(true, async () => json({ error: 'rate limited' }, 429)),
    );
    const result = await identifySongForUploadedClip(clip({ id: 9 }));
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/too many/i);
  });

  it('tries a single-window fast pass before the full-file scan', async () => {
    const spy = vi
      .spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit')
      .mockResolvedValue({ status: 'nomatch', message: null });
    vi.stubGlobal('fetch', fetchMockWithConfig(false));

    await identifySongForUploadedClip(
      clip({ id: 200, video_url: 'https://cdn.example.com/IMG_4020.mov' }),
    );

    expect(spy).toHaveBeenCalledTimes(2);
    // The fast pass is the same shape the working camera-upload path uses.
    expect(identifyCalls()[0]).not.toMatchObject({ scanWindows: true });
    expect(identifyCalls()[1]).toMatchObject({ scanWindows: true });
  });

  it('stops at the fast pass when it already matched', async () => {
    const spy = vi
      .spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit')
      .mockResolvedValue({
        status: 'match',
        artist: 'Phish',
        title: 'Tweezer',
        message: 'Identified: Tweezer — Phish',
      });
    vi.stubGlobal('fetch', fetchMockWithConfig(false));

    const result = await identifySongForUploadedClip(
      clip({ id: 201, video_url: 'https://cdn.example.com/IMG_4021.mov' }),
    );

    expect(result).toMatchObject({ status: 'match', title: 'Tweezer' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not call the worker after a native full-file no-match', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'nomatch',
      message: null,
    });
    const fetchMock = fetchMockWithConfig(true);
    vi.stubGlobal('fetch', fetchMock);

    const result = await identifySongForUploadedClip(
      clip({ id: 136, video_url: 'https://cdn.example.com/IMG_4016.mov' }),
    );

    expect(result.status).toBe('nomatch');
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes('identify-own-song'))).toBe(false);
  });

  it('sends the loudest 11s WAV to identify-music after a native no-match', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'nomatch',
      message: null,
      wavPath: 'file:///tmp/clip-136.loudest.wav',
      loudestStartSeconds: 24.5,
      loudestRms: 0.11,
    });
    vi.spyOn(nativeBridge, 'readNativeFileAsBlob').mockResolvedValue(
      new Blob([new Uint8Array(8000)], { type: 'audio/wav' }),
    );
    vi.spyOn(auddIdentify, 'identifyMusicWithAudD').mockResolvedValue({
      status: 'match',
      artist: 'Rihanna',
      title: 'Bitch Better Have My Money',
      message: 'Identified: Bitch Better Have My Money — Rihanna',
    });
    vi.stubGlobal('fetch', fetchMockWithConfig(true));

    const result = await identifySongForUploadedClip(
      clip({ id: 137, video_url: 'https://cdn.example.com/IMG_4016.mov' }),
    );

    expect(result).toMatchObject({ status: 'match', artist: 'Rihanna' });
    expect(auddIdentify.identifyMusicWithAudD).toHaveBeenCalledTimes(1);
  });

  it('skips ACRCloud entirely when the Worker has no keys', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'nomatch',
      message: null,
      wavPath: 'file:///tmp/clip-138.loudest.wav',
      loudestStartSeconds: 8,
      loudestRms: 0.2,
    });
    const acr = vi.spyOn(auddIdentify, 'identifyMusicWithAudD');
    vi.stubGlobal('fetch', fetchMockWithConfig(false));

    const result = await identifySongForUploadedClip(
      clip({ id: 138, video_url: 'https://cdn.example.com/IMG_4018.mov' }),
    );

    expect(result).toEqual({ status: 'nomatch', message: null });
    expect(acr).not.toHaveBeenCalled();
  });

  it('reports no match rather than an error when the ACRCloud quota is spent', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'nomatch',
      message: null,
      wavPath: 'file:///tmp/clip-139.loudest.wav',
      loudestStartSeconds: 8,
      loudestRms: 0.2,
    });
    vi.spyOn(nativeBridge, 'readNativeFileAsBlob').mockResolvedValue(
      new Blob([new Uint8Array(8000)], { type: 'audio/wav' }),
    );
    vi.spyOn(auddIdentify, 'identifyMusicWithAudD').mockResolvedValue({
      status: 'error',
      message: 'ACRCloud request quota exceeded (code 3003).',
    });
    vi.stubGlobal('fetch', fetchMockWithConfig(true));

    const result = await identifySongForUploadedClip(
      clip({ id: 139, video_url: 'https://cdn.example.com/IMG_4019.mov' }),
    );

    // A dead fallback must not become a red banner — the owner needs the
    // manual song field, which only opens on a non-error outcome.
    expect(result).toEqual({ status: 'nomatch', message: null });
  });

  it('joins an in-flight identify instead of starting a second pass', async () => {
    let release!: (value: AudDIdentifyResult) => void;
    const pending = new Promise<AudDIdentifyResult>((resolve) => {
      release = resolve;
    });
    const spy = vi
      .spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit')
      .mockReturnValue(pending);
    vi.stubGlobal('fetch', fetchMockWithConfig(false));

    const clip136 = clip({ id: 140, video_url: 'https://cdn.example.com/IMG_4016.mov' });
    const first = identifySongForUploadedClip(clip136);
    const second = identifySongForUploadedClip(clip136);
    release({ status: 'nomatch', message: null });
    await expect(first).resolves.toMatchObject({ status: 'nomatch' });
    await expect(second).resolves.toMatchObject({ status: 'nomatch' });
    // Two calls = one pass (fast pass + scan), not two passes.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('falls back to the worker when ShazamKit errors', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'error',
      message: 'Could not read the clip audio.',
    });
    const fetchMock = fetchMockWithConfig(true, async () =>
      json({ ok: true, match: { artist: 'Jay-Z', title: '99 Problems' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await identifySongForUploadedClip(
      clip({ id: 141, video_url: 'https://cdn.example.com/IMG_4018.mov' }),
    );

    expect(result).toMatchObject({ status: 'match', artist: 'Jay-Z', title: '99 Problems' });
  });

  it('reports the stages it walked through', async () => {
    vi.spyOn(shazamKitIdentify, 'identifyNativeFileWithShazamKit').mockResolvedValue({
      status: 'nomatch',
      message: null,
    });
    vi.stubGlobal('fetch', fetchMockWithConfig(false));

    const stages: string[] = [];
    await identifySongForUploadedClip(
      clip({ id: 142, video_url: 'https://cdn.example.com/IMG_4022.mov' }),
      { onStage: (event) => stages.push(event.stage) },
    );

    expect(stages).toEqual(['start', 'download', 'shazamkit-fast', 'shazamkit-scan']);
  });
});
