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

/** Native URLSession download into cache. Avoids WKWebView CORS / decodeAudioData hangs. */
export async function downloadRemoteMediaToCache(
  url: string,
  fileName: string,
): Promise<string | null> {
  if (!isNativeApp()) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'clip.mp4';
  const path = `momentum/identify/${safeName}`;
  try {
    const cached = await cachedIdentifyFileUri(safeName);
    if (cached) return cached;
    const result = await Filesystem.downloadFile({
      url: trimmed,
      path,
      directory: Directory.Cache,
      recursive: true,
    });
    if (result.path?.trim()) return result.path.trim();
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    return uri?.trim() || null;
  } catch (err) {
    console.warn('[identify] native download failed', err);
    return null;
  }
}

/** Avoid Filesystem.stat — a miss is logged as OS-PLUG-FILE-0008 even when caught. */
async function cachedIdentifyFileUri(safeName: string): Promise<string | null> {
  try {
    const listing = await Filesystem.readdir({
      path: 'momentum/identify',
      directory: Directory.Cache,
    });
    const found = listing.files.find((file) => file.name === safeName);
    if (!found || (found.size ?? 0) <= 50_000) return null;
    const { uri } = await Filesystem.getUri({
      path: `momentum/identify/${safeName}`,
      directory: Directory.Cache,
    });
    if (!uri?.trim()) return null;
    console.log('[identify] native download cache hit', safeName, found.size);
    return uri.trim();
  } catch {
    return null;
  }
}

export async function readNativeFileAsBlob(
  path: string,
  mimeType: string,
): Promise<Blob | null> {
  if (!isNativeApp()) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  try {
    const result = await Filesystem.readFile({ path: trimmed });
    const data = result.data;
    if (typeof data !== 'string' || !data) return null;
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  } catch (err) {
    console.warn('[identify] native file read failed', err);
    return null;
  }
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
  const trimmed = fileUri.trim();
  const path =
    trimmed.startsWith('file://') || trimmed.startsWith('capacitor://')
      ? trimmed
      : Capacitor.convertFileSrc(trimmed);
  await saveVideoToGallery(path, fileName);
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
