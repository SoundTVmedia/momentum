import { getNetworkReachability } from './network-utils';
import { UPLOAD_RETRY_CONFIG } from './upload-retry-config';

/** In-flight part retries only — job-level backoff lives in upload-retry-config.ts. */
const PART_RETRY_DELAYS_MS = [2_000, 4_000] as const;
export const MAX_UPLOAD_ATTEMPTS = UPLOAD_RETRY_CONFIG.quickAttemptCount;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientUploadError(err: unknown): boolean {
  if (err instanceof Error && err.message === 'Upload cancelled') return false;
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
    const reachable = await getNetworkReachability();
    if (!reachable.connected) {
      throw lastErr instanceof Error
        ? lastErr
        : new TypeError('Network error during part upload');
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientUploadError(err) || attempt >= MAX_UPLOAD_ATTEMPTS - 1) {
        throw err;
      }
      const stillReachable = await getNetworkReachability();
      if (!stillReachable.connected) {
        throw err;
      }
      opts?.onRetry?.(attempt + 1, err);
      await sleep(PART_RETRY_DELAYS_MS[attempt] ?? UPLOAD_RETRY_CONFIG.quickRetryDelayMs);
    }
  }
  throw lastErr;
}
