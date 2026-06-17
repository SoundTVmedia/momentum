import {
  cacheOutboxBlobs,
  persistOutboxVideo,
} from '@/react-app/lib/upload-outbox/blob-store';
import { saveOutboxBlobs } from '@/react-app/lib/upload-outbox/idb';
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
  await saveOutboxBlobs(PENDING_CAPTURE_JOB_ID, blobs);

  const gallery = await saveClipToDeviceGallery(video, fileName, {
    sourceKey: blobSourceKey(video),
    skipIfSaved: false,
  });

  return { localSaved: true, galleryMethod: gallery.method };
}

export { blobSourceKey } from '@/react-app/lib/upload-outbox/gallery-save';

/** Copy pending capture blob into a queue job (if same source). */
export async function adoptPendingCaptureForJob(
  jobId: string,
  video: Blob,
): Promise<boolean> {
  const { loadOutboxBlobs } = await import('@/react-app/lib/upload-outbox/idb');
  const pending = await loadOutboxBlobs(PENDING_CAPTURE_JOB_ID);
  if (!pending?.video) return false;
  if (blobSourceKey(pending.video) !== blobSourceKey(video)) return false;
  await persistOutboxVideo(jobId, pending.video, pending.thumbnail ?? null);
  return true;
}
