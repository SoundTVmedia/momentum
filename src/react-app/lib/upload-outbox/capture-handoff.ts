import { cacheOutboxBlobs, peekCachedOutboxBlobs } from '@/react-app/lib/upload-outbox/blob-store';
import { registerClipBlob } from '@/react-app/lib/upload-outbox/clip-blob-registry';
import { PENDING_CAPTURE_JOB_ID } from '@/react-app/lib/upload-outbox/capture-local-save';
import type { AudDNavPrefill } from '@/react-app/utils/auddIdentify';
import { blobSourceKey } from '@/react-app/lib/upload-outbox/gallery-save';

export const CAPTURE_HANDOFF_SESSION_KEY = 'momentum_capture_handoff_v1';
export const CAPTURE_DISCARDED_SESSION_KEY = 'momentum_capture_discarded_v1';
export const CAPTURE_SHARED_SESSION_KEY = 'momentum_capture_shared_v1';
export const CAPTURE_SHARED_BLOB_KEYS_KEY = 'momentum_capture_shared_blob_keys_v1';
export const CAPTURE_REVIEW_BLOCKED_KEY = 'momentum_capture_review_blocked_v1';
export const CAPTURE_SHARED_NATIVE_PATHS_KEY = 'momentum_capture_shared_native_paths_v1';
export const CAPTURE_SHARED_RECORDING_ATS_KEY = 'momentum_capture_shared_recording_ats_v1';
/** Set after Share/upload; cleared only when a new capture handoff opens caption. */
export const CAPTURE_REVIEW_SUPPRESS_KEY = 'momentum_capture_review_suppress_v1';
export const CAPTURE_REVIEW_SEARCH_PARAM = 'reviewCapture';
export const PENDING_CAPTURE_READY_EVENT = 'momentum:pending-capture-ready';

/** In-tab guard — survives UploadClip remount when WKWebView storage writes fail. */
let captureReviewSessionBlocked = false;

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

function readStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

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
    writeStorageItem(CAPTURE_HANDOFF_SESSION_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('writeCaptureHandoffMeta:', err);
  }
}

export function readCaptureHandoffMeta(): CaptureHandoffMeta | null {
  try {
    const raw = readStorageItem(CAPTURE_HANDOFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CaptureHandoffMeta;
  } catch {
    return null;
  }
}

export function clearCaptureHandoffMeta(): void {
  removeStorageItem(CAPTURE_HANDOFF_SESSION_KEY);
}

/** Block caption recovery after Share/upload until the next in-app capture handoff. */
export function blockCaptureReviewRecovery(): void {
  captureReviewSessionBlocked = true;
  writeStorageItem(CAPTURE_REVIEW_BLOCKED_KEY, String(Date.now()));
  writeStorageItem(CAPTURE_REVIEW_SUPPRESS_KEY, '1');
  markCaptureShared();
}

export function isCaptureReviewSessionBlocked(): boolean {
  return captureReviewSessionBlocked;
}

export function isCaptureReviewSuppressed(): boolean {
  return readStorageItem(CAPTURE_REVIEW_SUPPRESS_KEY) === '1';
}

export function clearCaptureReviewSuppression(): void {
  removeStorageItem(CAPTURE_REVIEW_SUPPRESS_KEY);
}

export function allowCaptureReviewRecovery(): void {
  captureReviewSessionBlocked = false;
  removeStorageItem(CAPTURE_REVIEW_BLOCKED_KEY);
  clearCaptureReviewSuppression();
}

export function readCaptureReviewBlockedAt(): number | null {
  const raw = readStorageItem(CAPTURE_REVIEW_BLOCKED_KEY);
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}

/** True when a new in-app recording should open the caption screen (not a stale handoff). */
export function canOpenCaptureReviewHandoff(blob: Blob, recordingStartedAt: string): boolean {
  if (!blob?.size) return false;
  if (wasBlobRecentlyShared(blob)) return false;
  if (wasRecordingStartedAtShared(recordingStartedAt)) return false;
  const blockedAt = readCaptureReviewBlockedAt();
  const recordAt = Date.parse(recordingStartedAt);
  if (
    isCaptureReviewRecoveryBlocked() &&
    blockedAt != null &&
    Number.isFinite(recordAt) &&
    recordAt <= blockedAt
  ) {
    return false;
  }
  return true;
}

/** Clear the post-Share block only for a genuinely new recording session. */
export function allowCaptureReviewForNewRecording(recordingStartedAt: string): void {
  const blockedAt = readCaptureReviewBlockedAt();
  const recordAt = Date.parse(recordingStartedAt);
  if (blockedAt == null || (Number.isFinite(recordAt) && recordAt > blockedAt)) {
    allowCaptureReviewRecovery();
    clearCaptureSharedMarker();
  }
}

/** True when stale route/IDB recovery must not reopen the caption screen. */
export function shouldSkipCaptureReviewHydration(): boolean {
  return (
    captureReviewSessionBlocked ||
    isCaptureReviewSuppressed() ||
    isCaptureReviewRecoveryBlocked()
  );
}

export function isCaptureReviewRecoveryBlocked(): boolean {
  return Boolean(readStorageItem(CAPTURE_REVIEW_BLOCKED_KEY));
}

/** Prevents route recovery from sending the user back to a clip they just discarded. */
export function markCaptureDiscarded(): void {
  writeStorageItem(CAPTURE_DISCARDED_SESSION_KEY, String(Date.now()));
}

export function clearCaptureDiscardedMarker(): void {
  removeStorageItem(CAPTURE_DISCARDED_SESSION_KEY);
}

export function wasCaptureRecentlyDiscarded(maxAgeMs = 120_000): boolean {
  try {
    const raw = readStorageItem(CAPTURE_DISCARDED_SESSION_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > maxAgeMs) {
      removeStorageItem(CAPTURE_DISCARDED_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Prevents route recovery from reopening caption after a successful Share. */
export function markCaptureShared(): void {
  writeStorageItem(CAPTURE_SHARED_SESSION_KEY, String(Date.now()));
}

type SharedBlobKeyEntry = { key: string; at: number };

function readSharedBlobKeys(): SharedBlobKeyEntry[] {
  try {
    const raw = readStorageItem(CAPTURE_SHARED_BLOB_KEYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SharedBlobKeyEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSharedBlobKeys(entries: SharedBlobKeyEntry[]): void {
  try {
    writeStorageItem(CAPTURE_SHARED_BLOB_KEYS_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

function readSharedNativePaths(): string[] {
  try {
    const raw = readStorageItem(CAPTURE_SHARED_NATIVE_PATHS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSharedNativePaths(paths: string[]): void {
  try {
    writeStorageItem(CAPTURE_SHARED_NATIVE_PATHS_KEY, JSON.stringify(paths));
  } catch {
    /* ignore */
  }
}

function readSharedRecordingAts(): string[] {
  try {
    const raw = readStorageItem(CAPTURE_SHARED_RECORDING_ATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSharedRecordingAts(ats: string[]): void {
  try {
    writeStorageItem(CAPTURE_SHARED_RECORDING_ATS_KEY, JSON.stringify(ats));
  } catch {
    /* ignore */
  }
}

/** Pin a capture session id so route recovery cannot reopen caption after Share. */
export function markRecordingStartedAtShared(at: string | null | undefined): void {
  const trimmed = at?.trim();
  if (!trimmed) return;
  const kept = readSharedRecordingAts().filter((entry) => entry !== trimmed);
  kept.push(trimmed);
  writeSharedRecordingAts(kept.slice(-32));
}

export function wasRecordingStartedAtShared(at: string | null | undefined): boolean {
  const trimmed = at?.trim();
  if (!trimmed) return false;
  return readSharedRecordingAts().includes(trimmed);
}

export function markNativeVideoPathShared(nativePath: string | null | undefined): void {
  const path = nativePath?.trim();
  if (!path) return;
  const kept = readSharedNativePaths().filter((p) => p !== path);
  kept.push(path);
  writeSharedNativePaths(kept);
}

export function wasNativeVideoPathShared(nativePath: string | null | undefined): boolean {
  const path = nativePath?.trim();
  if (!path) return false;
  return readSharedNativePaths().includes(path);
}

/** Track a specific clip blob so multi-clip batches do not resurrect after upload. */
export function markCaptureSharedForBlob(blob: Blob, nativePath?: string | null): void {
  markCaptureShared();
  markNativeVideoPathShared(nativePath);
  if (!blob?.size) return;
  const key = blobSourceKey(blob);
  const now = Date.now();
  const maxAgeMs = 86_400_000;
  const kept = readSharedBlobKeys().filter((e) => now - e.at <= maxAgeMs && e.key !== key);
  kept.push({ key, at: now });
  writeSharedBlobKeys(kept);
}

export function wasBlobRecentlyShared(blob: Blob, maxAgeMs = 86_400_000): boolean {
  if (!blob?.size) return false;
  const key = blobSourceKey(blob);
  const now = Date.now();
  return readSharedBlobKeys().some((e) => e.key === key && now - e.at <= maxAgeMs);
}

/** True when this blob was shared or is currently uploading / already published. */
export function isCaptureBlobConsumed(blob: Blob): boolean {
  return wasBlobRecentlyShared(blob);
}

export function shouldHydrateCaptureReview(recordingStartedAt?: string | null): boolean {
  if (shouldSkipCaptureReviewHydration()) return false;
  if (wasCaptureRecentlyDiscarded()) return false;
  if (wasRecordingStartedAtShared(recordingStartedAt)) return false;
  const handoffAt = readCaptureHandoffMeta()?.recordingStartedAt;
  if (wasRecordingStartedAtShared(handoffAt)) return false;
  return true;
}

export function clearCaptureSharedMarker(): void {
  removeStorageItem(CAPTURE_SHARED_SESSION_KEY);
}

export function wasCaptureRecentlyShared(maxAgeMs = 86_400_000): boolean {
  try {
    const raw = readStorageItem(CAPTURE_SHARED_SESSION_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > maxAgeMs) {
      removeStorageItem(CAPTURE_SHARED_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function dispatchPendingCaptureReady(recordingStartedAt?: string): void {
  if (!shouldHydrateCaptureReview(recordingStartedAt)) return;
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

/** True when the user landed from in-app capture (router state, handoff meta, or review URL). */
export function isQuickCaptureReviewFlow(
  search: string,
  nav?: {
    videoBlob?: unknown;
    videoFile?: unknown;
    fromQuickCapture?: boolean;
    recordingStartedAt?: string;
  } | null,
  handoff?: Pick<CaptureHandoffMeta, 'recordingStartedAt'> | null,
): boolean {
  if (!shouldHydrateCaptureReview(handoff?.recordingStartedAt)) return false;
  if (wasRecordingStartedAtShared(handoff?.recordingStartedAt)) return false;
  if (wantsCaptureReviewScreen(search)) return true;
  if (nav?.videoBlob || nav?.fromQuickCapture || nav?.recordingStartedAt) return true;
  if (handoff?.recordingStartedAt) return true;
  return false;
}

if (typeof window !== 'undefined') {
  captureReviewSessionBlocked =
    isCaptureReviewSuppressed() || isCaptureReviewRecoveryBlocked();
}
