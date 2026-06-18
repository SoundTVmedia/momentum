import type { StoredUploadBlobs } from './types';
import { loadOutboxBlobs, saveOutboxBlobs } from './idb';
import { getClipBlob } from './clip-blob-registry';

/** Same-tab fallback while IndexedDB write is in flight or for quick retry. */
const memoryCache = new Map<string, StoredUploadBlobs>();

export function cacheOutboxBlobs(jobId: string, blobs: StoredUploadBlobs): void {
  memoryCache.set(jobId, blobs);
}

export function peekCachedOutboxBlobs(jobId: string): StoredUploadBlobs | null {
  const row = memoryCache.get(jobId);
  if (row?.video && row.video.size > 0) return row;
  const pinned = getClipBlob(jobId);
  if (pinned) return { video: pinned, thumbnail: row?.thumbnail ?? null };
  return null;
}

export function clearCachedOutboxBlobs(jobId: string): void {
  memoryCache.delete(jobId);
}

export async function resolveOutboxBlobs(jobId: string): Promise<StoredUploadBlobs | null> {
  const cached = peekCachedOutboxBlobs(jobId);
  if (cached?.video) return cached;

  const pinned = getClipBlob(jobId);
  if (pinned) {
    const blobs: StoredUploadBlobs = { video: pinned, thumbnail: null };
    cacheOutboxBlobs(jobId, blobs);
    return blobs;
  }

  try {
    const fromDb = await loadOutboxBlobs(jobId);
    if (fromDb?.video && fromDb.video.size > 0) {
      memoryCache.set(jobId, fromDb);
      return fromDb;
    }
  } catch (err) {
    console.warn('resolveOutboxBlobs IndexedDB (using in-tab cache only):', err);
  }
  return null;
}

export async function waitForOutboxBlobs(
  jobId: string,
  opts?: { attempts?: number; delayMs?: number },
): Promise<StoredUploadBlobs | null> {
  const attempts = opts?.attempts ?? 10;
  const delayMs = opts?.delayMs ?? 300;
  for (let i = 0; i < attempts; i++) {
    const blobs = await resolveOutboxBlobs(jobId);
    if (blobs?.video) return blobs;
    if (i < attempts - 1) {
      await new Promise((r) => window.setTimeout(r, delayMs));
    }
  }
  return null;
}

/** Persist video immediately; thumbnail can be added later. */
export async function persistOutboxVideo(
  jobId: string,
  video: Blob,
  thumbnail?: Blob | null,
): Promise<{ idb: boolean }> {
  if (!video || video.size <= 0) {
    return { idb: false };
  }
  const blobs: StoredUploadBlobs = { video, thumbnail: thumbnail ?? null };
  cacheOutboxBlobs(jobId, blobs);
  try {
    await saveOutboxBlobs(jobId, blobs);
    return { idb: true };
  } catch (err) {
    console.warn('persistOutboxVideo IndexedDB (using in-tab cache):', err);
    return { idb: false };
  }
}

export async function persistOutboxThumbnail(jobId: string, thumbnail: Blob): Promise<void> {
  const existing = (await resolveOutboxBlobs(jobId)) ?? peekCachedOutboxBlobs(jobId);
  if (!existing?.video) return;
  const next = { video: existing.video, thumbnail };
  cacheOutboxBlobs(jobId, next);
  try {
    await saveOutboxBlobs(jobId, next);
  } catch (err) {
    console.warn('persistOutboxThumbnail IndexedDB (using in-tab cache):', err);
  }
}

export function formatUploadError(err: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return "You're offline. Your clip is saved on this device — we'll retry when you're back online.";
  }
  if (err instanceof TypeError) {
    return "Connection lost. Your clip is saved on this device — we'll retry when you're back online.";
  }
  if (err instanceof Error) {
    if (err.message === 'Upload cancelled') {
      return 'Slow connection — your clip is saved on this device. Upload will continue when the connection improves.';
    }
    if (/failed to fetch|network|load failed|part \d+ upload failed|timed out|too many upload/i.test(err.message)) {
      return "Slow connection — your clip is saved on this device. We'll keep trying in the background.";
    }
    return err.message;
  }
  return 'Upload failed';
}

/** Paused while waiting for IndexedDB / in-tab blob cache after refresh. */
export function isBlobWaitPauseError(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return lower.includes('upload will start shortly') || lower.includes('waiting for video');
}

/** Whether a failed job should auto-retry when the device comes back online. */
export function isRetryableUploadError(error: string | null): boolean {
  if (!error) return true;
  const lower = error.toLowerCase();
  if (lower.includes('not on this device')) return false;
  if (lower.includes('could not save clip')) return false;
  if (lower.includes('cannot be posted')) return false;
  if (lower.includes('invalid content feed')) return false;
  return (
    lower.includes('offline') ||
    lower.includes('connection lost') ||
    lower.includes('slow connection') ||
    lower.includes('waiting for connection') ||
    lower.includes('connection improves') ||
    lower.includes('upload cancelled') ||
    lower.includes('network') ||
    lower.includes('part ') ||
    lower.includes('failed to start upload') ||
    lower.includes('timed out') ||
    lower.includes("we'll retry when you're back online") ||
    lower.includes('upload will start shortly') ||
    lower.includes('waiting for video') ||
    lower.includes("we'll keep trying")
  );
}
