function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export type FetchJsonWithRetryOptions<T> = {
  signal?: AbortSignal;
  /** Per-URL attempt budget inside one load cycle (parent may loop again). */
  maxAttempts?: number;
  /** Return false to treat as retryable incomplete payload. */
  isValid?: (data: T) => boolean;
  shouldRetryStatus?: (status: number) => boolean;
};

const defaultShouldRetryStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

/**
 * Fetch JSON with backoff on transient HTTP/network failures and optional payload validation.
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit | undefined,
  opts: FetchJsonWithRetryOptions<T> = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const shouldRetryStatus = opts.shouldRetryStatus ?? defaultShouldRetryStatus;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const res = await fetch(url, { ...init, signal: opts.signal });
      if (!res.ok) {
        if (attempt < maxAttempts - 1 && shouldRetryStatus(res.status)) {
          await sleep(300 + attempt * 350, opts.signal);
          continue;
        }
        throw new Error(`Request failed (${res.status})`);
      }
      const data = (await res.json()) as T;
      if (opts.isValid && !opts.isValid(data)) {
        if (attempt < maxAttempts - 1) {
          await sleep(300 + attempt * 350, opts.signal);
          continue;
        }
        throw new Error('Incomplete response');
      }
      return data;
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (opts.signal?.aborted) throw err;
      if (attempt < maxAttempts - 1) {
        await sleep(300 + attempt * 350, opts.signal);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export { sleep };
