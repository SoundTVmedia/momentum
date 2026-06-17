import type { StoredUploadBlobs } from './types';
import { loadOutboxBlobs, saveOutboxBlobs } from './idb';

/** Same-tab fallback while IndexedDB write is in flight or for quick retry. */
const memoryCache = new Map<string, StoredUploadBlobs>();

export function cacheOutboxBlobs(jobId: string, blobs: StoredUploadBlobs): void {
  memoryCache.set(jobId, blobs);
}

export function peekCachedOutboxBlobs(jobId: string): StoredUploadBlobs | null {
  const row = memoryCache.get(jobId);
  return row?.video ? row : null;
}

export function clearCachedOutboxBlobs(jobId: string): void {
  memoryCache.delete(jobId);
}

export async function resolveOutboxBlobs(jobId: string): Promise<StoredUploadBlobs | null> {
  const cached = peekCachedOutboxBlobs(jobId);
  if (cached?.video) return cached;

  const fromDb = await loadOutboxBlobs(jobId);
  if (fromDb?.video) {
    memoryCache.set(jobId, fromDb);
    return fromDb;
  }
  return null;
}

/** Persist video immediately; thumbnail can be added later. */
export async function persistOutboxVideo(
  jobId: string,
  video: Blob,
  thumbnail?: Blob | null,
): Promise<void> {
  const blobs: StoredUploadBlobs = { video, thumbnail: thumbnail ?? null };
  cacheOutboxBlobs(jobId, blobs);
  await saveOutboxBlobs(jobId, blobs);
}

export async function persistOutboxThumbnail(jobId: string, thumbnail: Blob): Promise<void> {
  const existing = (await resolveOutboxBlobs(jobId)) ?? peekCachedOutboxBlobs(jobId);
  if (!existing?.video) return;
  const next = { video: existing.video, thumbnail };
  cacheOutboxBlobs(jobId, next);
  await saveOutboxBlobs(jobId, next);
}

export function formatUploadError(err: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return "You're offline. Your clip is saved on this device — we'll retry when you're back online.";
  }
  if (err instanceof TypeError) {
    return "Connection lost. Your clip is saved on this device — we'll retry when you're back online.";
  }
  if (err instanceof Error) {
    if (/failed to fetch|network|load failed|part \d+ upload failed/i.test(err.message)) {
      return "Slow connection — your clip is saved on this device. We'll keep trying in the background.";
    }
    return err.message;
  }
  return 'Upload failed';
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
    lower.includes('keep trying') ||
    lower.includes('network') ||
    lower.includes('part ') ||
    lower.includes('failed to start upload') ||
    lower.includes('timed out') ||
    lower.includes("we'll retry when you're back online")
  );
}
