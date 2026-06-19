import {
  cacheOutboxBlobs,
  clearCachedOutboxBlobs,
  persistOutboxVideo,
  peekCachedOutboxBlobs,
  resolveOutboxBlobs,
} from '@/react-app/lib/upload-outbox/blob-store';
import { deleteOutboxJob, saveOutboxBlobs } from '@/react-app/lib/upload-outbox/idb';
import type { StoredUploadBlobs } from '@/react-app/lib/upload-outbox/types';
import {
  blobSourceKey,
  saveClipToDeviceGallery,
} from '@/react-app/lib/upload-outbox/gallery-save';

/** IndexedDB key for the most recent capture (before Share creates a queue job). */
export const PENDING_CAPTURE_JOB_ID = '__momentum_pending_capture__';

/**
 * First action after capture: persist locally (always works offline),
 * then best-effort Photos save on native shell.
 */
export async function persistClipLocallyOnCapture(
  video: Blob,
  fileName: string,
): Promise<{ localSaved: boolean; galleryMethod: string }> {
  const blobs = { video, thumbnail: null as Blob | null };
  cacheOutboxBlobs(PENDING_CAPTURE_JOB_ID, blobs);
  try {
    await saveOutboxBlobs(PENDING_CAPTURE_JOB_ID, blobs);
  } catch (err) {
    console.warn('persistClipLocallyOnCapture IndexedDB (using in-tab cache):', err);
  }

  const gallery = await saveClipToDeviceGallery(video, fileName, {
    sourceKey: blobSourceKey(video),
    skipIfSaved: false,
  });

  return { localSaved: true, galleryMethod: gallery.method };
}

export { blobSourceKey } from '@/react-app/lib/upload-outbox/gallery-save';

export async function loadPendingCapture(): Promise<StoredUploadBlobs | null> {
  return resolveOutboxBlobs(PENDING_CAPTURE_JOB_ID);
}

/** Remove the pre-Share capture blob after Share or explicit discard. */
export async function clearPendingCapture(): Promise<void> {
  clearCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
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
