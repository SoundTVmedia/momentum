/** iOS WKWebView may lack `AbortSignal.timeout` — use AbortController instead. */
export function createFetchTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timeoutId =
    typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  return {
    signal: controller.signal,
    cancel: () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
    },
  };
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 22_000,
): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init?.signal;
  const timeoutId =
    typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && !parentSignal?.aborted) {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    }
    throw err;
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

export function fetchErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError'
      ? 'Request timed out'
      : error.message || error.name;
  }
  if (error instanceof Error) {
    const msg = error.message?.trim();
    if (msg) return msg;
    if (error.name) return error.name;
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Network request failed';
}

export function isFetchTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError';
  }
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
    const msg = error.message.toLowerCase();
    return msg.includes('timed out') || msg.includes('timeout');
  }
  return false;
}

export function isFetchNetworkError(error: unknown): boolean {
  if (isFetchTimeoutError(error)) return true;
  if (error instanceof TypeError) return true;
  const msg = fetchErrorMessage(error).toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection')
  );
}
