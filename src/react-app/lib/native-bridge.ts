/**
 * Native bridge for Capacitor — background upload, gallery save, push registration.
 * Web falls back to IndexedDB outbox (ClipUploadQueueContext).
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';
import { PushNotifications } from '@capacitor/push-notifications';

export type NativePlatform = 'web' | 'ios' | 'android';

export function getNativePlatform(): NativePlatform {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function registerNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch (err) {
    console.warn('registerNativePush:', err);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read video data'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read video data'));
    reader.readAsDataURL(blob);
  });
}

/** Write clip bytes to native cache; returns a URI/path suitable for Media.saveVideo. */
export async function writeVideoToNativeCache(blob: Blob, fileName: string): Promise<string> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `momentum/clips/${safeName}`;
  const data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
  });
  return result.uri;
}

export async function saveVideoToGallery(filePath: string, fileName?: string): Promise<void> {
  if (!isNativeApp()) return;
  const baseName = fileName?.replace(/\.[^.]+$/, '') || undefined;
  await Media.saveVideo({
    path: filePath,
    ...(baseName ? { fileName: baseName } : {}),
  });
}

/** Save a native filesystem video URI directly to Photos (skips blob round-trip). */
export async function saveNativeVideoUriToGallery(
  fileUri: string,
  fileName?: string,
): Promise<void> {
  if (!isNativeApp()) return;
  await saveVideoToGallery(fileUri, fileName);
}

/**
 * Hook for a future native background uploader (URLSession / WorkManager).
 * Persists the cache path so native code can resume multipart upload after app backgrounding.
 */
export function scheduleNativeBackgroundUpload(jobId: string, cachePath?: string): void {
  if (!isNativeApp()) return;
  const bridge = (
    window as Window & {
      MomentumUploadBridge?: { schedule?: (id: string, path?: string) => void };
    }
  ).MomentumUploadBridge;
  bridge?.schedule?.(jobId, cachePath);
}
