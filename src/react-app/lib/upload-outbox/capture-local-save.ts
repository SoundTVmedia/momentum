import {
  clearCachedOutboxBlobs,
  persistOutboxVideo,
  peekCachedOutboxBlobs,
  resolveOutboxBlobs,
  waitForOutboxBlobs,
} from '@/react-app/lib/upload-outbox/blob-store';
import { deleteOutboxJob, saveOutboxBlobs } from '@/react-app/lib/upload-outbox/idb';
import type { StoredUploadBlobs } from '@/react-app/lib/upload-outbox/types';
import {
  blobSourceKey,
  saveClipToDeviceGallery,
} from '@/react-app/lib/upload-outbox/gallery-save';
import {
  primePendingCaptureVideo,
  clearCaptureHandoffMeta,
  readCaptureHandoffMeta,
  clearCaptureDiscardedMarker,
  allowCaptureReviewForNewRecording,
  canOpenCaptureReviewHandoff,
  markPendingCaptureReviewHandoff,
  dispatchPendingCaptureReady,
  writeCaptureHandoffMeta,
  wasBlobRecentlyShared,
  wasNativeVideoPathShared,
  wasRecordingStartedAtShared,
  shouldSkipCaptureReviewHydration,
  isActiveCaptureHandoff,
  captureReviewSearch,
  type CaptureHandoffMeta,
} from '@/react-app/lib/upload-outbox/capture-handoff';
import {
  resolveNativeCaptureUploadBlob,
  captureVideoBlobLikelyHasAudio,
  nativeRecordingHasRequiredAudio,
  shouldUseNativeIosCapture,
} from '@/react-app/lib/native-capture';
import type { NavigateFunction } from 'react-router';
export const PENDING_CAPTURE_JOB_ID = '__momentum_pending_capture__';

let pendingCaptureFlushGeneration = 0;

/** Cancel in-flight flushPendingCaptureToDevice IDB writes after Share/discard. */
export function invalidatePendingCaptureFlush(): void {
  pendingCaptureFlushGeneration += 1;
}

export function clearPendingCaptureMemory(opts?: { force?: boolean }): void {
  if (!opts?.force && isActiveCaptureHandoff()) return;
  clearCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  clearCaptureHandoffMeta();
}

/**
 * Persist capture clip to IndexedDB (offline outbox). Photos save is handled by
 * {@link flushPendingCaptureToDevice} during quick-capture handoff — not here.
 */
export async function persistClipLocallyOnCapture(
  video: Blob,
  fileName: string,
): Promise<{ localSaved: boolean }> {
  void fileName;
  primePendingCaptureVideo(video);

  try {
    await saveOutboxBlobs(PENDING_CAPTURE_JOB_ID, {
      video,
      thumbnail: null,
    });
  } catch (err) {
    console.warn('persistClipLocallyOnCapture IndexedDB (using in-tab cache):', err);
  }

  return { localSaved: true };
}

/**
 * Non-blocking device persist after capture — IDB + Photos while caption screen opens.
 * Memory cache is primed synchronously before navigation.
 */
export async function flushPendingCaptureToDevice(
  video: Blob,
  fileName: string,
  opts?: { nativeVideoUri?: string },
): Promise<void> {
  if (!video?.size) return;
  if (shouldSkipCaptureReviewHydration()) return;
  const generation = pendingCaptureFlushGeneration;
  if (generation !== pendingCaptureFlushGeneration) return;
  try {
    await saveOutboxBlobs(PENDING_CAPTURE_JOB_ID, { video, thumbnail: null });
    if (generation !== pendingCaptureFlushGeneration) {
      try {
        await deleteOutboxJob(PENDING_CAPTURE_JOB_ID);
      } catch {
        /* ignore */
      }
      return;
    }
  } catch (err) {
    console.warn('flushPendingCaptureToDevice IndexedDB:', err);
  }
  if (generation !== pendingCaptureFlushGeneration) return;
  try {
    await saveClipToDeviceGallery(video, fileName, {
      sourceKey: blobSourceKey(video),
      skipIfSaved: true,
      nativeVideoUri: opts?.nativeVideoUri,
    });
  } catch (err) {
    console.warn('flushPendingCaptureToDevice gallery:', err);
  }
}

export type CompleteCaptureHandoffOpts = {
  blob: Blob;
  fileName: string;
  navigate: NavigateFunction;
  recordingStartedAt: string;
  meta: Omit<CaptureHandoffMeta, 'recordingStartedAt'>;
  nativeVideoPath?: string;
  nativeAudioTrackCount?: number;
  routerState?: Record<string, unknown>;
  onAfterNavigate?: () => void;
  onReleaseResources?: () => void;
};

/**
 * Upload-outbox handoff: pin blob in memory, write session meta, navigate to caption screen,
 * then flush IndexedDB + Photos without blocking navigation.
 */
export async function completeCaptureHandoff(opts: CompleteCaptureHandoffOpts): Promise<boolean> {
  const {
    blob,
    fileName,
    navigate,
    recordingStartedAt,
    meta,
    nativeVideoPath,
    nativeAudioTrackCount,
    routerState,
    onAfterNavigate,
    onReleaseResources,
  } = opts;

  if (!blob?.size) {
    console.warn('completeCaptureHandoff: skipped — empty blob');
    return false;
  }

  if (shouldUseNativeIosCapture() && nativeVideoPath?.trim()) {
    if (!nativeRecordingHasRequiredAudio(nativeAudioTrackCount)) {
      console.warn('completeCaptureHandoff: blocked — native clip has no audio track');
      return false;
    }
  } else if (shouldUseNativeIosCapture()) {
    try {
      const scanLen = Math.min(blob.size, 2 * 1024 * 1024);
      const head = new Uint8Array(await blob.slice(0, scanLen).arrayBuffer());
      let hasAudio = captureVideoBlobLikelyHasAudio(head);
      if (!hasAudio && blob.size > scanLen) {
        const tail = new Uint8Array(await blob.slice(blob.size - scanLen).arrayBuffer());
        hasAudio = captureVideoBlobLikelyHasAudio(tail);
      }
      if (!hasAudio) {
        console.warn('completeCaptureHandoff: blocked — video blob missing audio');
        return false;
      }
    } catch (err) {
      console.warn('completeCaptureHandoff: blocked — could not verify audio', err);
      return false;
    }
  }
  // Web browser capture: audio validated at record stop via live mic tracks.

  allowCaptureReviewForNewRecording(recordingStartedAt);

  if (!canOpenCaptureReviewHandoff(blob, recordingStartedAt)) {
    console.warn('completeCaptureHandoff: skipped — clip already shared or stale handoff');
    return false;
  }

  primePendingCaptureVideo(blob);
  clearCaptureDiscardedMarker();
  markPendingCaptureReviewHandoff(recordingStartedAt);
  writeCaptureHandoffMeta({
    recordingStartedAt,
    ...meta,
    nativeVideoPath,
    nativeAudioTrackCount,
  });

  onReleaseResources?.();

  navigate(
    { pathname: '/upload', search: captureReviewSearch() },
    {
      replace: true,
      state: {
        recordingStartedAt,
        fromQuickCapture: true,
        ...(nativeVideoPath ? { nativeVideoPath } : {}),
        ...routerState,
      },
    },
  );

  queueMicrotask(() => dispatchPendingCaptureReady(recordingStartedAt));

  onAfterNavigate?.();

  void flushPendingCaptureToDevice(blob, fileName, {
    nativeVideoUri: nativeVideoPath,
  });

  return true;
}

export async function loadPendingCapture(): Promise<StoredUploadBlobs | null> {
  if (shouldSkipCaptureReviewHydration()) {
    return null;
  }
  const handoffAt = readCaptureHandoffMeta()?.recordingStartedAt;
  if (wasRecordingStartedAtShared(handoffAt)) {
    await clearPendingCapture();
    return null;
  }
  const pending = await resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  if (pending?.video?.size && wasBlobRecentlyShared(pending.video)) {
    await clearPendingCapture();
    return null;
  }
  return pending;
}

/** Resolve pre-Share clip from outbox memory, IndexedDB, or native recording path. */
export async function resolvePendingCaptureForReview(opts?: {
  nativeVideoPath?: string | null;
  /** When false, do not reload from native temp file or re-prime pending cache. */
  allowNativeReload?: boolean;
}): Promise<Blob | null> {
  const cached = peekCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  if (cached?.video?.size) {
    if (wasBlobRecentlyShared(cached.video)) return null;
    return cached.video;
  }

  const fromDb = await waitForOutboxBlobs(PENDING_CAPTURE_JOB_ID, {
    attempts: 20,
    delayMs: 100,
  });
  if (fromDb?.video?.size) {
    if (wasBlobRecentlyShared(fromDb.video)) return null;
    return fromDb.video;
  }

  if (opts?.allowNativeReload === false) return null;

  const nativePath =
    opts?.nativeVideoPath?.trim() ||
    readCaptureHandoffMeta()?.nativeVideoPath?.trim() ||
    '';
  if (!nativePath) return null;
  if (wasNativeVideoPathShared(nativePath)) return null;

  try {
    const blob = await resolveNativeCaptureUploadBlob(nativePath, null, { requireAudio: true });
    if (blob?.size) {
      if (wasBlobRecentlyShared(blob)) return null;
      return blob;
    }
  } catch (err) {
    console.warn('resolvePendingCaptureForReview native path:', err);
  }
  return null;
}

/** Remove the pre-Share capture blob after Share or explicit discard. */
export async function clearPendingCapture(opts?: { force?: boolean }): Promise<void> {
  if (!opts?.force && isActiveCaptureHandoff()) return;
  invalidatePendingCaptureFlush();
  clearPendingCaptureMemory({ force: true });
  try {
    await deleteOutboxJob(PENDING_CAPTURE_JOB_ID);
  } catch (err) {
    console.warn('clearPendingCapture:', err);
  }
}

/** Copy pending capture blob into a queue job (memory cache or IndexedDB). */
export async function adoptPendingCaptureForJob(
  jobId: string,
  video: Blob,
): Promise<boolean> {
  const pending =
    peekCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID) ??
    (await resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID));
  const videoToSave = pending?.video ?? video;
  if (!videoToSave || videoToSave.size === 0) return false;
  await persistOutboxVideo(jobId, videoToSave, pending?.thumbnail ?? null);
  clearCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  try {
    await deleteOutboxJob(PENDING_CAPTURE_JOB_ID);
  } catch {
    /* ignore */
  }
  return Boolean(peekCachedOutboxBlobs(jobId)?.video);
}
