import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { downloadRemoteMediaToCache } from '@/react-app/lib/native-bridge';
import {
  normalizeIdentifyResult,
  type AudDIdentifyResult,
} from '@/react-app/utils/auddIdentify';
import { identifyNativeFileWithShazamKit } from '@/react-app/utils/shazamKitIdentify';
import {
  resolveClipDownloadUrl,
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
const IDENTIFY_CACHE_EXTENSIONS = new Set(['mov', 'm4v', 'mp4', 'm4a', 'caf', 'wav']);
const identifyInFlight = new Map<string, Promise<AudDIdentifyResult>>();

function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined' || !window.location?.origin) return url;
  return new URL(url, window.location.origin).href;
}

/**
 * Best progressive MP4 for native ShazamKit: Stream first, else published
 * `/api/files/…` or `video_url`. Untitled clips often have no Stream id yet.
 */
export function clipPlayerShazamKitMediaUrl(clip: ClipPlaybackFields): string | null {
  const raw = resolveClipDownloadUrl(clip);
  return raw ? absoluteMediaUrl(raw) : null;
}

/** Keep the source container extension so AVFoundation opens Photos `.mov` files. */
export function identifyCacheFileName(clipId: string | number, mediaUrl: string): string {
  let ext = 'mp4';
  try {
    const pathname = new URL(mediaUrl, 'https://local.invalid').pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    if (match && IDENTIFY_CACHE_EXTENSIONS.has(match[1].toLowerCase())) {
      ext = match[1].toLowerCase();
    }
  } catch {
    // keep mp4
  }
  return `clip-${clipId}.${ext}`;
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
    console.log(
      '[identify] clip-player worker',
      res.status,
      data.ok === false ? data.error : data.match?.title || data.message || (data.skipped ? 'skipped' : 'ok'),
    );

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
    console.warn('[identify] clip-player worker failed', err);
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
 * Worker ACRCloud runs only when ShazamKit is unavailable or errors. A clean
 * native no-match after the full-file window scan is final — Range-fetching
 * a Capgo/Photos `.mov` into ACR always returns code 2004.
 */
export async function identifySongForUploadedClip(
  clip: ClipPlaybackFields,
): Promise<AudDIdentifyResult> {
  const clipId = String(clipNumericId(clip) ?? clip.stream_video_id ?? 'unknown');
  const existing = identifyInFlight.get(clipId);
  if (existing) {
    console.log('[identify] clip-player join in-flight', clipId);
    return existing;
  }
  const run = identifySongForUploadedClipUncapped(clip, clipId).finally(() => {
    identifyInFlight.delete(clipId);
  });
  identifyInFlight.set(clipId, run);
  return run;
}

async function identifySongForUploadedClipUncapped(
  clip: ClipPlaybackFields,
  clipId: string,
): Promise<AudDIdentifyResult> {
  const mediaUrl = clipPlayerShazamKitMediaUrl(clip);
  console.log(
    '[identify] clip-player start',
    clipId,
    mediaUrl ?? 'no-media-url',
    'stream=',
    clip.stream_video_id ?? '',
    'video=',
    clip.video_url ?? '',
    'r2=',
    clip.r2_raw_key ?? '',
  );

  if (mediaUrl) {
    const localPath = await downloadRemoteMediaToCache(
      mediaUrl,
      identifyCacheFileName(clipId, mediaUrl),
    );
    const shazamPath = localPath || mediaUrl;
    console.log('[identify] clip-player shazamkit path', localPath ? 'local-cache' : 'remote-url');
    const shazam = await identifyNativeFileWithShazamKit(shazamPath, { scanWindows: true });
    if (shazam?.status === 'match') {
      console.log('[identify] clip-player shazamkit match', clipId);
      return normalizeIdentifyResult(shazam);
    }
    if (shazam?.status === 'nomatch') {
      console.log('[identify] clip-player shazamkit nomatch after full-file scan', clipId);
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
