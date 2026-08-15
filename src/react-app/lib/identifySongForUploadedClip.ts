import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { downloadRemoteMediaToCache } from '@/react-app/lib/native-bridge';
import {
  normalizeIdentifyResult,
  type AudDIdentifyResult,
} from '@/react-app/utils/auddIdentify';
import { identifyNativeFileWithShazamKit } from '@/react-app/utils/shazamKitIdentify';
import {
  streamMp4Url,
  streamVideoIdFromClip,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';

type ServerIdentifyResponse = {
  ok?: boolean;
  skipped?: boolean;
  match?: { artist?: string; title?: string; confidence?: number } | null;
  error?: string;
  message?: string;
  acrcloudCode?: number;
};

const SERVER_IDENTIFY_TIMEOUT_MS = 55_000;

/** Progressive Stream MP4 for native ShazamKit (faststart; no WebAudio Range). */
export function clipPlayerShazamKitMediaUrl(clip: ClipPlaybackFields): string | null {
  const streamId = streamVideoIdFromClip(clip);
  return streamId ? streamMp4Url(streamId) : null;
}

async function identifySongViaServer(clip: ClipPlaybackFields): Promise<AudDIdentifyResult> {
  const clipId = clipNumericId(clip);
  const streamVideoId =
    typeof clip.stream_video_id === 'string' ? clip.stream_video_id.trim() : '';
  if (clipId == null && !streamVideoId) {
    return { status: 'error', message: 'Invalid clip' };
  }

  const payload: Record<string, unknown> = {};
  if (clipId != null) payload.clipId = clipId;
  if (streamVideoId) payload.streamVideoId = streamVideoId;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SERVER_IDENTIFY_TIMEOUT_MS);
  try {
    const res = await fetch('/api/clips/identify-own-song', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      signal: ctrl.signal,
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as ServerIdentifyResponse;

    if (data.skipped) {
      return normalizeIdentifyResult({
        status: 'skipped',
        message: typeof data.message === 'string' ? data.message : null,
      });
    }
    if (res.status === 429) {
      return { status: 'error', message: 'Too many song lookups — wait a moment and try again.' };
    }
    if (!res.ok || data.ok === false) {
      const base = typeof data.error === 'string' ? data.error : 'Song lookup failed';
      const code =
        typeof data.acrcloudCode === 'number' && Number.isFinite(data.acrcloudCode)
          ? data.acrcloudCode
          : null;
      return normalizeIdentifyResult({
        status: 'error',
        message: code != null ? `${base} [ACR ${code}]` : base,
      });
    }
    if (!data.match || (!data.match.artist && !data.match.title)) {
      return { status: 'nomatch', message: null };
    }

    const artist = (data.match.artist ?? '').trim();
    const title = (data.match.title ?? '').trim();
    const message =
      title && artist
        ? `Identified: ${title} — ${artist}`
        : title
          ? `Identified: ${title}`
          : artist
            ? `Identified: ${artist}`
            : null;
    const confidence =
      typeof data.match.confidence === 'number' && Number.isFinite(data.match.confidence)
        ? data.match.confidence
        : undefined;
    return { status: 'match', artist, title, message, confidence };
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && /abort/i.test(err.name + err.message));
    return {
      status: 'error',
      message: aborted ? 'Song identification timed out. Try again.' : 'Song lookup failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Clip-player / edit-modal song ID for a published clip.
 *
 * Same native path as capture: download the Cloudflare Stream MP4 with
 * URLSession, then `ShazamKit.recognizeFile` on that local file. Do not
 * Range-fetch Capgo MP4s into WebAudio — WKWebView `decodeAudioData` can hang
 * and never reach the plugin (current production JS still does this).
 * Worker ACRCloud is the fallback.
 */
export async function identifySongForUploadedClip(
  clip: ClipPlaybackFields,
): Promise<AudDIdentifyResult> {
  const clipId = clipNumericId(clip) ?? clip.stream_video_id ?? 'unknown';
  const mediaUrl = clipPlayerShazamKitMediaUrl(clip);
  console.log('[identify] clip-player start', clipId, mediaUrl ?? 'no-stream-url');

  if (mediaUrl) {
    const localPath = await downloadRemoteMediaToCache(mediaUrl, `clip-${clipId}.mp4`);
    const shazamPath = localPath || mediaUrl;
    console.log('[identify] clip-player shazamkit path', localPath ? 'local-cache' : 'remote-url');
    const shazam = await identifyNativeFileWithShazamKit(shazamPath);
    if (shazam?.status === 'match') {
      console.log('[identify] clip-player shazamkit match', clipId);
      return normalizeIdentifyResult(shazam);
    }
    console.log(
      '[identify] clip-player shazamkit',
      shazam?.status ?? 'unavailable',
      'falling back to worker',
    );
  }

  console.log('[identify] clip-player via worker', clipId);
  return identifySongViaServer(clip);
}
