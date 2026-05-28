import { useEffect, useRef, useState } from 'react';
import { sleep } from '@/react-app/lib/fetch-json-with-retry';

export type UseAutoRetryPageLoadOptions<T> = {
  enabled: boolean;
  load: (signal: AbortSignal) => Promise<T>;
  validate?: (data: T) => boolean;
  /** Fast retries with backoff before settling into a slower poll interval. */
  maxFastAttempts?: number;
};

/**
 * Keeps loading (and retrying) until `load` succeeds or the route unmounts.
 * Avoids surfacing a dead-end error when artist/venue pages are still being created upstream.
 */
export function useAutoRetryPageLoad<T>({
  enabled,
  load,
  validate,
  maxFastAttempts = 10,
}: UseAutoRetryPageLoadOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const loadRef = useRef(load);
  const validateRef = useRef(validate);
  loadRef.current = load;
  validateRef.current = validate;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setSlowLoad(false);
      return;
    }

    const ac = new AbortController();
    let attempt = 0;

    void (async () => {
      setLoading(true);
      setSlowLoad(false);
      setData(null);

      while (!ac.signal.aborted) {
        attempt += 1;
        if (attempt > 1) setSlowLoad(true);
        try {
          const result = await loadRef.current(ac.signal);
          if (validateRef.current && !validateRef.current(result)) {
            throw new Error('Page data not ready');
          }
          if (!ac.signal.aborted) {
            setData(result);
            setLoading(false);
            setSlowLoad(false);
          }
          return;
        } catch (err) {
          if (ac.signal.aborted) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const delay =
            attempt < maxFastAttempts
              ? Math.min(4500, 300 + attempt * 450)
              : 2800;
          try {
            await sleep(delay, ac.signal);
          } catch {
            return;
          }
        }
      }
    })();

    return () => ac.abort();
  }, [enabled, maxFastAttempts]);

  return { data, loading, slowLoad };
}
