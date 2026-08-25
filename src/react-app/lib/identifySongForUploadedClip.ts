import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import {
  acrCloudExhaustedReason,
  isAcrCloudExhaustedMessage,
  isAcrCloudFallbackAvailable,
  isAcrCloudMisconfiguredMessage,
  markAcrCloudExhausted,
} from '@/react-app/lib/identify-music-config';
import {
  downloadRemoteMediaToCache,
  readNativeFileAsBlob,
} from '@/react-app/lib/native-bridge';
import {
  identifyMusicWithAudD,
  normalizeIdentifyResult,
  type AudDIdentifyResult,
} from '@/react-app/utils/auddIdentify';
import { identifyNativeFileWithShazamKit } from '@/react-app/utils/shazamKitIdentify';
import {
  resolveClipDownloadUrl,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';
import type { IdentifyStageReporter } from '@/shared/identify-stage';
import {
  IDENTIFY_ACR_FALLBACK_TIMEOUT_MS,
  IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS,
} from '@/shared/identify-music-limits';

type ServerIdentifyResponse = {
  ok?: boolean;
  skipped?: boolean;
  match?: { artist?: string; title?: string; confidence?: number } | null;
  error?: string;
  message?: string;
  acrcloudCode?: number;
};

const SERVER_IDENTIFY_TIMEOUT_MS = IDENTIFY_ACR_FALLBACK_TIMEOUT_MS;
const IDENTIFY_CACHE_EXTENSIONS = new Set(['mov', 'm4v', 'mp4', 'm4a', 'caf', 'wav']);
const identifyInFlight = new Map<string, Promise<AudDIdentifyResult>>();

/** No song was found, but nothing is broken — callers open manual entry. */
const NO_MATCH: AudDIdentifyResult = { status: 'nomatch', message: null };

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

/**
 * Published clip row for a just-uploaded clip. Device/library uploads have no
 * local native path, so identify has to read the file we just published.
 */
export async function fetchClipPlaybackFieldsById(
  clipId: number | string,
): Promise<ClipPlaybackFields | null> {
  try {
    const res = await fetch(`/api/clips/${encodeURIComponent(String(clipId))}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ClipPlaybackFields;
  } catch (err) {
    console.warn('[identify] could not load published clip', clipId, err);
    return null;
  }
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
  options?: { onStage?: IdentifyStageReporter },
): Promise<AudDIdentifyResult> {
  const clipId = String(clipNumericId(clip) ?? clip.stream_video_id ?? 'unknown');
  const existing = identifyInFlight.get(clipId);
  if (existing) {
    console.log('[identify] clip-player join in-flight', clipId);
    return existing;
  }
  const run = identifySongForUploadedClipUncapped(clip, clipId, options?.onStage).finally(
    () => {
      identifyInFlight.delete(clipId);
    },
  );
  identifyInFlight.set(clipId, run);
  return run;
}

/**
 * ACRCloud fallback on the 11s WAV the native scan already exported for the
 * loudest window. Only runs when the Worker has keys; an exhausted quota is
 * recorded once and reported as "no match" so manual entry opens immediately.
 */
async function acrFallbackForLoudestWindow(
  clipId: string,
  wavPath: string | null | undefined,
  report: IdentifyStageReporter,
): Promise<AudDIdentifyResult | null> {
  const path = wavPath?.trim();
  if (!path) return null;
  if (!(await isAcrCloudFallbackAvailable())) {
    console.log(
      '[identify] clip-player acr skipped',
      clipId,
      acrCloudExhaustedReason() ?? 'not configured',
    );
    return null;
  }

  report({ stage: 'acrcloud', detail: 'loudest-window wav' });
  const wav = await readNativeFileAsBlob(path, 'audio/wav');
  if (!wav || wav.size <= 4096) {
    console.log('[identify] clip-player acr wav unreadable', clipId);
    return null;
  }

  const acr = normalizeIdentifyResult(await identifyMusicWithAudD(wav));
  console.log(
    '[identify] clip-player acr',
    acr.status,
    acr.status === 'match' ? acr.title : acr.message,
    'wavBytes=',
    wav.size,
    'clip=',
    clipId,
  );
  if (acr.status === 'match') return acr;

  const message = acr.status === 'error' ? acr.message : null;
  if (isAcrCloudExhaustedMessage(message) || isAcrCloudMisconfiguredMessage(message)) {
    // A spent quota or bad keys must not surface as a red banner on the clip.
    markAcrCloudExhausted(message ?? 'ACRCloud rejected the request');
    return null;
  }
  return acr.status === 'nomatch' ? acr : null;
}

async function identifySongForUploadedClipUncapped(
  clip: ClipPlaybackFields,
  clipId: string,
  onStage?: IdentifyStageReporter,
): Promise<AudDIdentifyResult> {
  const report: IdentifyStageReporter = (event) => {
    console.log('[identify] stage', clipId, event.stage, event.detail ?? '');
    onStage?.(event);
  };

  report({ stage: 'start' });
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
    report({ stage: 'download', detail: mediaUrl });
    const localPath = await downloadRemoteMediaToCache(
      mediaUrl,
      identifyCacheFileName(clipId, mediaUrl),
    );
    const shazamPath = localPath || mediaUrl;
    console.log('[identify] clip-player shazamkit path', localPath ? 'local-cache' : 'remote-url');

    // Fast pass: one 11s signature from the head of the file. This is byte for
    // byte the call the quick-capture upload path makes, and it is the only
    // shape that has been reliable, so try it before the long scan.
    report({ stage: 'shazamkit-fast', detail: localPath ? 'local-cache' : 'remote-url' });
    const fast = await identifyNativeFileWithShazamKit(shazamPath, {
      timeoutMs: IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS,
    });
    if (fast?.status === 'match') {
      console.log('[identify] clip-player shazamkit fast-pass match', clipId);
      return normalizeIdentifyResult(fast);
    }
    console.log('[identify] clip-player fast pass', fast?.status ?? 'unavailable');

    // The song may start later in the clip, so walk the rest of the file.
    // A window that errors no longer kills the pass — native keeps scanning.
    report({ stage: 'shazamkit-scan' });
    const shazam = await identifyNativeFileWithShazamKit(shazamPath, { scanWindows: true });
    if (shazam?.status === 'match') {
      console.log('[identify] clip-player shazamkit match', clipId);
      return normalizeIdentifyResult(shazam);
    }

    if (shazam?.status === 'nomatch') {
      console.log(
        '[identify] clip-player shazamkit nomatch after full-file scan',
        clipId,
        'windows=',
        shazam.windowsTried ?? '?',
        'of',
        shazam.windowCount ?? '?',
        'loudest=',
        shazam.loudestStartSeconds ?? '?',
        'rms=',
        shazam.loudestRms ?? '?',
        'cleanNoMatch — catalogs often miss live mixes; opening manual title',
      );
      const acr = await acrFallbackForLoudestWindow(clipId, shazam.wavPath, report);
      if (acr) return acr;
      // Shazam read the audio fine and found nothing: that is a real no-match,
      // not a failure. Say so, so the owner gets the manual field.
      return NO_MATCH;
    }

    // ShazamKit itself could not run (unavailable, unreadable audio, timeout).
    // The Worker can still read the published file, so let it try.
    console.log(
      '[identify] clip-player shazamkit',
      shazam?.status ?? 'unavailable',
      shazam?.status === 'error' ? shazam.message : '',
      'falling back to worker',
    );
  }

  if (!(await isAcrCloudFallbackAvailable())) {
    console.log(
      '[identify] clip-player worker skipped',
      clipId,
      acrCloudExhaustedReason() ?? 'ACRCloud not configured',
    );
    return NO_MATCH;
  }

  report({ stage: 'worker' });
  console.log('[identify] clip-player via worker', clipId);
  const server = await identifySongViaServer(clip);
  if (server.status === 'error' && isAcrCloudExhaustedMessage(server.message)) {
    markAcrCloudExhausted(server.message);
    return NO_MATCH;
  }
  return server;
}
