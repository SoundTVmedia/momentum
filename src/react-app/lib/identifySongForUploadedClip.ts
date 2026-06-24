import { resolveClipDownloadUrl, type ClipPlaybackFields } from '@/shared/clip-playback';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import {
  identifyMusicForClip,
  normalizeIdentifyResult,
  type AudDIdentifyResult,
} from '@/react-app/utils/auddIdentify';

function absoluteClipMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).href;
}

export async function fetchUploadedClipVideoBlob(
  clip: ClipPlaybackFields,
): Promise<Blob | null> {
  const url = resolveClipDownloadUrl(clip);
  if (!url) return null;
  try {
    const res = await fetch(absoluteClipMediaUrl(url), { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

type ServerIdentifyResponse = {
  ok?: boolean;
  skipped?: boolean;
  match?: { artist?: string; title?: string; confidence?: number } | null;
  error?: string;
  message?: string;
  acrcloudCode?: number;
};

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

  try {
    const res = await fetch('/api/clips/identify-own-song', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
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
  } catch {
    return { status: 'error', message: 'Song lookup failed' };
  }
}

/** Run ACR on an uploaded clip (browser snippet first, Worker fallback). */
export async function identifySongForUploadedClip(
  clip: ClipPlaybackFields,
): Promise<AudDIdentifyResult> {
  const blob = await fetchUploadedClipVideoBlob(clip);
  if (blob) {
    return normalizeIdentifyResult(await identifyMusicForClip(blob));
  }
  return identifySongViaServer(clip);
}
