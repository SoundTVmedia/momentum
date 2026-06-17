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
};

/**
 * Best-effort save to the device photo library.
 * Clip is always cached in IndexedDB; native shell writes to the gallery when available.
 */
export async function saveClipToDeviceGallery(
  video: Blob,
  fileName: string,
): Promise<GallerySaveResult> {
  if (isNativeApp()) {
    try {
      const cachePath = await writeVideoToNativeCache(video, fileName);
      await saveVideoToGallery(cachePath, fileName);
      return { saved: true, method: 'native', nativeCachePath: cachePath };
    } catch (err) {
      console.warn('saveClipToDeviceGallery native:', err);
    }
  }

  return { saved: true, method: 'device_cache' };
}
