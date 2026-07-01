import { cacheOutboxBlobs, peekCachedOutboxBlobs } from '@/react-app/lib/upload-outbox/blob-store';
import { registerClipBlob } from '@/react-app/lib/upload-outbox/clip-blob-registry';
import { PENDING_CAPTURE_JOB_ID } from '@/react-app/lib/upload-outbox/capture-local-save';
import type { AudDNavPrefill } from '@/react-app/utils/auddIdentify';

export const CAPTURE_HANDOFF_SESSION_KEY = 'momentum_capture_handoff_v1';
export const CAPTURE_DISCARDED_SESSION_KEY = 'momentum_capture_discarded_v1';
export const CAPTURE_REVIEW_SEARCH_PARAM = 'reviewCapture';
export const PENDING_CAPTURE_READY_EVENT = 'momentum:pending-capture-ready';

export type CaptureHandoffMeta = {
  recordingStartedAt: string;
  nativeVideoPath?: string;
  captureGeo?: {
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  videoMetadata?: {
    recording_orientation?: 'portrait' | 'landscape';
    video_resolution_w?: number;
    video_resolution_h?: number;
  };
  auddPrefill?: AudDNavPrefill | null;
  showData?: Record<string, unknown>;
};

/** Sync: pin clip in the upload-outbox memory layer (same tab, survives router navigation). */
export function primePendingCaptureVideo(video: Blob): void {
  if (!video?.size) return;
  cacheOutboxBlobs(PENDING_CAPTURE_JOB_ID, { video, thumbnail: null });
  registerClipBlob(PENDING_CAPTURE_JOB_ID, video);
}

export function hasPrimedPendingCapture(): boolean {
  const pending = peekCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  return Boolean(pending?.video?.size);
}

export function writeCaptureHandoffMeta(meta: CaptureHandoffMeta): void {
  try {
    sessionStorage.setItem(CAPTURE_HANDOFF_SESSION_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('writeCaptureHandoffMeta:', err);
  }
}

export function readCaptureHandoffMeta(): CaptureHandoffMeta | null {
  try {
    const raw = sessionStorage.getItem(CAPTURE_HANDOFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CaptureHandoffMeta;
  } catch {
    return null;
  }
}

export function clearCaptureHandoffMeta(): void {
  try {
    sessionStorage.removeItem(CAPTURE_HANDOFF_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Prevents route recovery from sending the user back to a clip they just discarded. */
export function markCaptureDiscarded(): void {
  try {
    sessionStorage.setItem(CAPTURE_DISCARDED_SESSION_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearCaptureDiscardedMarker(): void {
  try {
    sessionStorage.removeItem(CAPTURE_DISCARDED_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function wasCaptureRecentlyDiscarded(maxAgeMs = 120_000): boolean {
  try {
    const raw = sessionStorage.getItem(CAPTURE_DISCARDED_SESSION_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > maxAgeMs) {
      sessionStorage.removeItem(CAPTURE_DISCARDED_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function dispatchPendingCaptureReady(recordingStartedAt?: string): void {
  window.dispatchEvent(
    new CustomEvent(PENDING_CAPTURE_READY_EVENT, {
      detail: { recordingStartedAt: recordingStartedAt ?? null },
    }),
  );
}

export function captureReviewSearch(): string {
  return `?${CAPTURE_REVIEW_SEARCH_PARAM}=1`;
}

export function wantsCaptureReviewScreen(search: string): boolean {
  return new URLSearchParams(search).get(CAPTURE_REVIEW_SEARCH_PARAM) === '1';
}
