const DEFAULT_UPLOAD_FETCH_TIMEOUT_MS = 120_000;
export const PART_UPLOAD_FETCH_TIMEOUT_MS = 300_000;

/** Fetch with timeout + optional parent abort (stall / user cancel). */
export async function uploadFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_UPLOAD_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const parentSignal = init?.signal;

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timeoutId =
    typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    const { timeoutMs: _timeoutMs, signal: _signal, ...rest } = init ?? {};
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && !parentSignal?.aborted) {
      throw new TypeError('Upload request timed out');
    }
    throw err;
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}
