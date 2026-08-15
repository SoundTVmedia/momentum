import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import {
  normalizeIdentifyResult,
  type AudDIdentifyResult,
} from '@/react-app/utils/auddIdentify';
import type { ClipPlaybackFields } from '@/shared/clip-playback';

type ServerIdentifyResponse = {
  ok?: boolean;
  skipped?: boolean;
  match?: { artist?: string; title?: string; confidence?: number } | null;
  error?: string;
  message?: string;
  acrcloudCode?: number;
};

const SERVER_IDENTIFY_TIMEOUT_MS = 55_000;

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
 * Do not Range-fetch the MP4 and decode it in WebAudio here. Capgo recordings
 * keep `moov` at the end, so a start-Range of ~11s often cannot decode — and
 * WKWebView `decodeAudioData` can hang instead of rejecting. That left the
 * player on "Identifying…" with zero native ShazamKit logs. The Worker uses
 * Cloudflare Stream (faststart) first, then ACRCloud, with an ≤11s sample.
 */
export async function identifySongForUploadedClip(
  clip: ClipPlaybackFields,
): Promise<AudDIdentifyResult> {
  console.log(
    '[identify] clip-player via worker',
    clipNumericId(clip) ?? clip.stream_video_id ?? 'unknown',
  );
  return identifySongViaServer(clip);
}
