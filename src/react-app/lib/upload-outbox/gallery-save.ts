import {
  isNativeApp,
  saveVideoToGallery,
  writeVideoToNativeCache,
} from '@/react-app/lib/native-bridge';
import { isNetworkAvailable } from '@/react-app/lib/upload-outbox/network-utils';

export type GallerySaveResult = {
  saved: boolean;
  method: 'native' | 'share' | 'device_cache';
  /** Native filesystem URI after write (for background upload bridge). */
  nativeCachePath?: string;
  skipped?: boolean;
};

const savedGalleryKeys = new Set<string>();

export function blobSourceKey(blob: Blob): string {
  const name = blob instanceof File ? blob.name : 'blob';
  return `${name}:${blob.size}:${blob.type || 'video/webm'}`;
}

/**
 * Save clip to the device photo library when the platform allows.
 * - Native Capacitor app: writes to Photos (works offline).
 * - Mobile web: cannot silently save to Photos — clip stays in IndexedDB.
 * Never blocks on share sheet when offline.
 */
export async function saveClipToDeviceGallery(
  video: Blob,
  fileName: string,
  opts?: { sourceKey?: string; skipIfSaved?: boolean },
): Promise<GallerySaveResult> {
  const sourceKey = opts?.sourceKey ?? blobSourceKey(video);
  if (opts?.skipIfSaved && savedGalleryKeys.has(sourceKey)) {
    return { saved: true, method: 'device_cache', skipped: true };
  }

  if (isNativeApp()) {
    try {
      const cachePath = await writeVideoToNativeCache(video, fileName);
      await saveVideoToGallery(cachePath, fileName);
      savedGalleryKeys.add(sourceKey);
      return { saved: true, method: 'native', nativeCachePath: cachePath };
    } catch (err) {
      console.warn('saveClipToDeviceGallery native:', err);
    }
  }

  // Web browsers cannot write to the iOS/Android photo library programmatically.
  // Skip share when offline — it can hang and block the upload pipeline.
  if (isNetworkAvailable() && typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const type = video.type || 'video/mp4';
      const file = new File([video], fileName, { type });
      const canShare =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      if (canShare) {
        await navigator.share({
          files: [file],
          title: 'Momentum clip',
        });
        savedGalleryKeys.add(sourceKey);
        return { saved: true, method: 'share' };
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('saveClipToDeviceGallery share:', err);
      }
    }
  }

  savedGalleryKeys.add(sourceKey);
  return { saved: true, method: 'device_cache' };
}

/** After capture: native → Photos; web → IndexedDB only (via capture-local-save). */
export async function saveCapturedClipToGallery(video: Blob, fileName: string): Promise<void> {
  await saveClipToDeviceGallery(video, fileName, {
    sourceKey: blobSourceKey(video),
    skipIfSaved: true,
  });
}
