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
  canOpenNativePathCaptureReviewHandoff,
  markPendingCaptureReviewHandoff,
  markCaptureHandoffBusy,
  dispatchPendingCaptureReady,
  writeCaptureHandoffMeta,
  wasBlobRecentlyShared,
  wasNativeVideoPathShared,
  wasRecordingStartedAtShared,
  shouldSkipCaptureReviewHydration,
  isActiveCaptureHandoff,
  captureReviewSearch,
  clearCaptureHandoffBusy,
  clearPendingCaptureReviewHandoff,
  wantsCaptureReviewScreen,
  type CaptureHandoffMeta,
} from '@/react-app/lib/upload-outbox/capture-handoff';
import {
  resolveNativeCaptureUploadBlob,
  captureVideoBlobLikelyHasAudio,
  finalizeNativeRecordingForHandoff,
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

export type BeginNativePathCaptureHandoffOpts = {
  fileName: string;
  navigate: NavigateFunction;
  recordingStartedAt: string;
  nativeVideoPath: string;
  nativeAudioTrackCount?: number;
  meta: Omit<CaptureHandoffMeta, 'recordingStartedAt'>;
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

  if (shouldUseNativeIosCapture()) {
    if (!nativeRecordingHasRequiredAudio(nativeAudioTrackCount)) {
      try {
        const scanLen = Math.min(blob.size, 2 * 1024 * 1024);
        const regions: Uint8Array[] = [
          new Uint8Array(await blob.slice(0, scanLen).arrayBuffer()),
        ];
        if (blob.size > scanLen) {
          regions.push(new Uint8Array(await blob.slice(blob.size - scanLen).arrayBuffer()));
        }
        if (blob.size > scanLen * 3) {
          const mid = Math.max(0, Math.floor(blob.size / 2) - Math.floor(scanLen / 2));
          regions.push(new Uint8Array(await blob.slice(mid, mid + scanLen).arrayBuffer()));
        }
        const hasAudio = regions.some((region) => captureVideoBlobLikelyHasAudio(region));
        if (!hasAudio) {
          console.warn('completeCaptureHandoff: blocked — native clip has no audio track');
          return false;
        }
      } catch (err) {
        console.warn('completeCaptureHandoff: blocked — could not verify audio', err);
        return false;
      }
    }
  }
  // Web browser capture: audio validated at record stop via live mic tracks.

  allowCaptureReviewForNewRecording(recordingStartedAt);

  if (!canOpenCaptureReviewHandoff(blob, recordingStartedAt)) {
    console.warn('completeCaptureHandoff: skipped — clip already shared or stale handoff');
    return false;
  }

  markCaptureHandoffBusy(8000);
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
  // Dismiss the feed capture overlay before navigation — otherwise AppRouteChrome keeps
  // the outlet hidden (native capture chrome) and the caption screen never appears.
  onAfterNavigate?.();

  dispatchPendingCaptureReady(recordingStartedAt);

  navigate(
    { pathname: '/upload', search: captureReviewSearch() },
    {
      replace: true,
      state: {
        recordingStartedAt,
        fromQuickCapture: true,
        videoBlob: blob,
        ...(nativeVideoPath ? { nativeVideoPath } : {}),
        ...routerState,
      },
    },
  );

  queueMicrotask(() => dispatchPendingCaptureReady(recordingStartedAt));

  void flushPendingCaptureToDevice(blob, fileName, {
    nativeVideoUri: nativeVideoPath,
  });

  return true;
}

/**
 * Navigate to caption immediately with a native file path — preview via convertFileSrc
 * while finalize/read runs in the background.
 */
export function beginNativePathCaptureHandoff(
  opts: BeginNativePathCaptureHandoffOpts,
): boolean {
  const {
    navigate,
    recordingStartedAt,
    nativeVideoPath,
    nativeAudioTrackCount,
    meta,
    routerState,
    onAfterNavigate,
    onReleaseResources,
  } = opts;

  const path = nativeVideoPath.trim();
  if (!path) {
    console.warn('beginNativePathCaptureHandoff: skipped — empty path');
    return false;
  }

  allowCaptureReviewForNewRecording(recordingStartedAt);

  if (!canOpenNativePathCaptureReviewHandoff(path, recordingStartedAt)) {
    console.warn('beginNativePathCaptureHandoff: skipped — clip already shared or stale handoff');
    return false;
  }

  markCaptureHandoffBusy(15_000);
  clearCaptureDiscardedMarker();
  markPendingCaptureReviewHandoff(recordingStartedAt);
  writeCaptureHandoffMeta({
    recordingStartedAt,
    ...meta,
    nativeVideoPath: path,
    nativeAudioTrackCount,
  });

  onReleaseResources?.();
  onAfterNavigate?.();
  dispatchPendingCaptureReady(recordingStartedAt);

  navigate(
    { pathname: '/upload', search: captureReviewSearch() },
    {
      replace: true,
      state: {
        recordingStartedAt,
        fromQuickCapture: true,
        nativeVideoPath: path,
        ...routerState,
      },
    },
  );

  queueMicrotask(() => dispatchPendingCaptureReady(recordingStartedAt));
  return true;
}

/** After path-first navigation — read muxed file, prime memory cache, flush IDB/Photos. */
export async function primePendingCaptureAfterNativeFinalize(
  nativeVideoPath: string,
  fileName: string,
  nativeAudioTrackCount?: number,
): Promise<Blob> {
  const blob = await finalizeNativeRecordingForHandoff(
    nativeVideoPath,
    nativeAudioTrackCount,
  );
  if (!blob?.size) {
    throw new Error('Recorded video is empty');
  }
  primePendingCaptureVideo(blob);
  dispatchPendingCaptureReady(readCaptureHandoffMeta()?.recordingStartedAt ?? undefined);
  clearCaptureHandoffBusy();
  void flushPendingCaptureToDevice(blob, fileName, {
    nativeVideoUri: nativeVideoPath,
  });
  return blob;
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

/** Drop stale handoff locks when opening capture outside the caption review screen. */
export function resetStaleCaptureSessionUnlessOnReview(
  pathname: string,
  search: string,
): void {
  if (pathname === '/upload' && wantsCaptureReviewScreen(search)) return;
  clearCaptureHandoffBusy();
  clearPendingCaptureReviewHandoff();
  clearPendingCaptureMemory({ force: true });
  void clearPendingCapture({ force: true });
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
