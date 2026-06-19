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
 * Save clip to the device photo library when the platform allows.
 * - Native Capacitor app: writes to Photos (works offline).
 * - Mobile web: IndexedDB only — never opens the system share sheet.
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

  // Web: clips stay in IndexedDB — do not open the system share / save sheet.
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
