const PART_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 45_000];
export const MAX_UPLOAD_ATTEMPTS = PART_RETRY_DELAYS_MS.length + 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientUploadError(err: unknown): boolean {
  if (err instanceof Error && err.message === 'Upload cancelled') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes('upload cancelled')) return false;
    if (m.includes('cannot be posted')) return false;
    if (m.includes('invalid content')) return false;
    if (m.includes('not on this device')) return false;
    return (
      m.includes('network') ||
      m.includes('failed to fetch') ||
      m.includes('load failed') ||
      m.includes('part ') ||
      m.includes('timed out') ||
      m.includes('connection') ||
      m.includes('503') ||
      m.includes('502') ||
      m.includes('504') ||
      m.includes('429')
    );
  }
  return false;
}

export async function withUploadBackoff<T>(
  fn: () => Promise<T>,
  opts?: {
    signal?: AbortSignal;
    onRetry?: (attempt: number, err: unknown) => void;
  },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt++) {
    if (opts?.signal?.aborted) {
      throw new Error('Upload cancelled');
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientUploadError(err) || attempt >= MAX_UPLOAD_ATTEMPTS - 1) {
        throw err;
      }
      opts?.onRetry?.(attempt + 1, err);
      await sleep(PART_RETRY_DELAYS_MS[attempt] ?? 45_000);
    }
  }
  throw lastErr;
}
