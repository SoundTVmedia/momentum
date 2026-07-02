import {
  isNativeApp,
  saveNativeVideoUriToGallery,
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
const inFlightGalleryKeys = new Set<string>();

export function blobSourceKey(blob: Blob): string {
  const name = blob instanceof File ? blob.name : 'blob';
  return `${name}:${blob.size}:${blob.type || 'video/webm'}`;
}

/** True when this clip was saved or a Photos write is already in progress. */
export function isGallerySaveCommitted(sourceKey: string): boolean {
  return savedGalleryKeys.has(sourceKey) || inFlightGalleryKeys.has(sourceKey);
}

function beginGallerySave(sourceKey: string): boolean {
  if (isGallerySaveCommitted(sourceKey)) return false;
  inFlightGalleryKeys.add(sourceKey);
  return true;
}

function commitGallerySave(sourceKey: string): void {
  inFlightGalleryKeys.delete(sourceKey);
  savedGalleryKeys.add(sourceKey);
}

function abortGallerySave(sourceKey: string): void {
  inFlightGalleryKeys.delete(sourceKey);
}

/**
 * Save clip to the device photo library when the platform allows.
 * - Native Capacitor app: writes to Photos (works offline).
 * - Mobile web: IndexedDB only — never opens the system share sheet.
 */
export async function saveClipToDeviceGallery(
  video: Blob,
  fileName: string,
  opts?: {
    sourceKey?: string;
    skipIfSaved?: boolean;
    /** When set, save this native capture file URI directly (iOS hybrid capture). */
    nativeVideoUri?: string;
  },
): Promise<GallerySaveResult> {
  const sourceKey = opts?.sourceKey ?? blobSourceKey(video);
  if (opts?.skipIfSaved && isGallerySaveCommitted(sourceKey)) {
    return { saved: true, method: 'device_cache', skipped: true };
  }
  if (!beginGallerySave(sourceKey)) {
    return { saved: true, method: 'device_cache', skipped: true };
  }

  if (isNativeApp()) {
    try {
      if (opts?.nativeVideoUri) {
        try {
          await saveNativeVideoUriToGallery(opts.nativeVideoUri, fileName);
          commitGallerySave(sourceKey);
          return {
            saved: true,
            method: 'native',
            nativeCachePath: opts.nativeVideoUri,
          };
        } catch (nativeUriErr) {
          console.warn('saveClipToDeviceGallery native uri:', nativeUriErr);
        }
      }
      const cachePath = await writeVideoToNativeCache(video, fileName);
      await saveVideoToGallery(cachePath, fileName);
      commitGallerySave(sourceKey);
      return { saved: true, method: 'native', nativeCachePath: cachePath };
    } catch (err) {
      abortGallerySave(sourceKey);
      console.warn('saveClipToDeviceGallery native:', err);
    }
    return { saved: false, method: 'device_cache' };
  }

  // Web: clips stay in IndexedDB — do not open the system share / save sheet.
  commitGallerySave(sourceKey);
  return { saved: true, method: 'device_cache' };
}

/** After capture: native → Photos; web → IndexedDB only (via capture-local-save). */
export async function saveCapturedClipToGallery(video: Blob, fileName: string): Promise<void> {
  await saveClipToDeviceGallery(video, fileName, {
    sourceKey: blobSourceKey(video),
    skipIfSaved: true,
  });
}
