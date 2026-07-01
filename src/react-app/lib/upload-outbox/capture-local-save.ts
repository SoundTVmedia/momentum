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
} from '@/react-app/lib/upload-outbox/capture-handoff';
import { nativeVideoPathToBlob } from '@/react-app/lib/native-capture';
export const PENDING_CAPTURE_JOB_ID = '__momentum_pending_capture__';

/**
 * First action after capture: persist locally (always works offline),
 * then best-effort Photos save on native shell.
 */
export async function persistClipLocallyOnCapture(
  video: Blob,
  fileName: string,
  opts?: { nativeVideoUri?: string },
): Promise<{ localSaved: boolean; galleryMethod: string }> {
  primePendingCaptureVideo(video);

  try {
    await saveOutboxBlobs(PENDING_CAPTURE_JOB_ID, {
      video,
      thumbnail: null,
    });
  } catch (err) {
    console.warn('persistClipLocallyOnCapture IndexedDB (using in-tab cache):', err);
  }

  const gallery = await saveClipToDeviceGallery(video, fileName, {
    sourceKey: blobSourceKey(video),
    skipIfSaved: false,
    nativeVideoUri: opts?.nativeVideoUri,
  });

  return { localSaved: true, galleryMethod: gallery.method };
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
  primePendingCaptureVideo(video);
  try {
    await saveOutboxBlobs(PENDING_CAPTURE_JOB_ID, { video, thumbnail: null });
  } catch (err) {
    console.warn('flushPendingCaptureToDevice IndexedDB:', err);
  }
  try {
    await saveClipToDeviceGallery(video, fileName, {
      sourceKey: blobSourceKey(video),
      skipIfSaved: false,
      nativeVideoUri: opts?.nativeVideoUri,
    });
  } catch (err) {
    console.warn('flushPendingCaptureToDevice gallery:', err);
  }
}

export { blobSourceKey } from '@/react-app/lib/upload-outbox/gallery-save';

export async function loadPendingCapture(): Promise<StoredUploadBlobs | null> {
  return resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID);
}

/** Resolve pre-Share clip from outbox memory, IndexedDB, or native recording path. */
export async function resolvePendingCaptureForReview(opts?: {
  nativeVideoPath?: string | null;
}): Promise<Blob | null> {
  const cached = peekCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  if (cached?.video?.size) return cached.video;

  const fromDb = await waitForOutboxBlobs(PENDING_CAPTURE_JOB_ID, {
    attempts: 20,
    delayMs: 100,
  });
  if (fromDb?.video?.size) return fromDb.video;

  const nativePath =
    opts?.nativeVideoPath?.trim() ||
    readCaptureHandoffMeta()?.nativeVideoPath?.trim() ||
    '';
  if (!nativePath) return null;

  try {
    const blob = await nativeVideoPathToBlob(nativePath);
    if (blob.size > 0) {
      primePendingCaptureVideo(blob);
      return blob;
    }
  } catch (err) {
    console.warn('resolvePendingCaptureForReview native path:', err);
  }
  return null;
}

/** Remove the pre-Share capture blob after Share or explicit discard. */
export async function clearPendingCapture(): Promise<void> {
  clearCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  clearCaptureHandoffMeta();
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
  return Boolean(peekCachedOutboxBlobs(jobId)?.video);
}
