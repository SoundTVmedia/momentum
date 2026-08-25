/**
 * Native bridge for Capacitor — background upload, gallery save, push registration.
 * Web falls back to IndexedDB outbox (ClipUploadQueueContext).
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';
import { PushNotifications } from '@capacitor/push-notifications';
import { IDENTIFY_NATIVE_DOWNLOAD_TIMEOUT_MS } from '@/shared/identify-music-limits';

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

/**
 * A cached file smaller than this is a truncated download or an error body
 * (an HTML 404 page is a few KB). Reusing one pins a clip to permanent
 * identify failure, so it is discarded and fetched again instead.
 */
const MIN_IDENTIFY_CACHE_BYTES = 200_000;

/**
 * Expected size of the remote media, so a short download is detected instead of
 * being handed to AVFoundation as a corrupt file.
 */
async function remoteContentLength(url: string, timeoutMs: number): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length') ?? '');
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Native URLSession download into cache. Avoids WKWebView CORS / decodeAudioData hangs. */
export async function downloadRemoteMediaToCache(
  url: string,
  fileName: string,
  options?: { timeoutMs?: number },
): Promise<string | null> {
  if (!isNativeApp()) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'clip.mp4';
  const path = `momentum/identify/${safeName}`;
  const timeoutMs = options?.timeoutMs ?? IDENTIFY_NATIVE_DOWNLOAD_TIMEOUT_MS;
  const startedAt = Date.now();

  try {
    const expectedBytes = await remoteContentLength(trimmed, 10_000);
    const cached = await cachedIdentifyFileUri(safeName, expectedBytes);
    if (cached) return cached;

    const download = Filesystem.downloadFile({
      url: trimmed,
      path,
      directory: Directory.Cache,
      recursive: true,
    });
    const result = await withDownloadTimeout(download, timeoutMs, safeName);
    if (!result) return null;

    const bytes = await identifyCacheFileSize(safeName);
    console.log(
      '[identify] native download done',
      safeName,
      `${bytes ?? '?'}B`,
      `expected=${expectedBytes ?? '?'}`,
      `${Date.now() - startedAt}ms`,
    );
    if (bytes != null && !downloadLooksComplete(bytes, expectedBytes)) {
      console.warn('[identify] native download truncated, discarding', safeName, bytes);
      await removeIdentifyCacheFile(safeName);
      return null;
    }

    if (result.path?.trim()) return result.path.trim();
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    return uri?.trim() || null;
  } catch (err) {
    console.warn('[identify] native download failed', err);
    await removeIdentifyCacheFile(safeName);
    return null;
  }
}

/** A short read is worse than no read: AVFoundation reports it as a bad file. */
export function downloadLooksComplete(
  bytes: number,
  expectedBytes: number | null | undefined,
): boolean {
  if (bytes < MIN_IDENTIFY_CACHE_BYTES) return false;
  if (expectedBytes == null || expectedBytes <= 0) return true;
  return bytes >= expectedBytes * 0.98;
}

function withDownloadTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn('[identify] native download timed out', label, `${ms}ms`);
      resolve(null);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        console.warn('[identify] native download rejected', label, err);
        resolve(null);
      },
    );
  });
}

/** Avoid Filesystem.stat — a miss is logged as OS-PLUG-FILE-0008 even when caught. */
async function identifyCacheFileSize(safeName: string): Promise<number | null> {
  try {
    const listing = await Filesystem.readdir({
      path: 'momentum/identify',
      directory: Directory.Cache,
    });
    const found = listing.files.find((file) => file.name === safeName);
    return found ? (found.size ?? 0) : null;
  } catch {
    return null;
  }
}

async function removeIdentifyCacheFile(safeName: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path: `momentum/identify/${safeName}`,
      directory: Directory.Cache,
    });
  } catch {
    /* nothing cached to remove */
  }
}

async function cachedIdentifyFileUri(
  safeName: string,
  expectedBytes: number | null,
): Promise<string | null> {
  const size = await identifyCacheFileSize(safeName);
  if (size == null) return null;
  if (!downloadLooksComplete(size, expectedBytes)) {
    console.log('[identify] discarding partial cache', safeName, size);
    await removeIdentifyCacheFile(safeName);
    return null;
  }
  try {
    const { uri } = await Filesystem.getUri({
      path: `momentum/identify/${safeName}`,
      directory: Directory.Cache,
    });
    if (!uri?.trim()) return null;
    console.log('[identify] native download cache hit', safeName, size);
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
 * Capacitor hook for a native background uploader (URLSession / WorkManager).
 * Expo RN uploads use FileSystem BACKGROUND sessions in multipart.ts instead.
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
