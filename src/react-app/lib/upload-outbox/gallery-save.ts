import {
  isNativeApp,
  saveVideoToGallery,
  writeVideoToNativeCache,
} from '@/react-app/lib/native-bridge';

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
 * Save clip to the device photo library (native) or offer share-to-Photos on mobile web.
 * Dedupes by sourceKey so capture + enqueue do not double-save.
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

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
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

/** Save to gallery right after capture (native shell only — no user gesture needed). */
export async function saveCapturedClipToGallery(video: Blob, fileName: string): Promise<void> {
  if (!isNativeApp()) return;
  await saveClipToDeviceGallery(video, fileName, {
    sourceKey: blobSourceKey(video),
    skipIfSaved: true,
  });
}
