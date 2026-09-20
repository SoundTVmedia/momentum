/**
 * Named upload-retry schedule. Edit here — do not scatter delays inline.
 *
 * Three attempts in quick succession, then 1 min, 5 min, 20 min, capped at 20 min.
 * Do not retry more aggressively than this (no network polling).
 */
export const UPLOAD_RETRY_CONFIG = {
  /** Failed attempts 1–2 retry after this delay (attempt 3 is still in the quick window). */
  quickAttemptCount: 3,
  quickRetryDelayMs: 2_000,
  /** After the quick window: 1 minute, 5 minutes, then 20 minutes forever. */
  backoffDelaysMs: [60_000, 5 * 60_000, 20 * 60_000] as const,
  backoffCapMs: 20 * 60_000,
  /** Parallel in-flight uploads (FIFO among queued jobs). */
  maxConcurrentUploads: 2,
  /** Festival / stadium: queue many clips before any of them can upload. */
  maxQueueSize: 50,
} as const;

/**
 * Delay before the next job-level attempt after `failedAttemptCount` failures.
 * `failedAttemptCount` is 1 after the first failure (before the second try).
 */
export function delayMsForUploadAttempt(failedAttemptCount: number): number {
  const { quickAttemptCount, quickRetryDelayMs, backoffDelaysMs, backoffCapMs } =
    UPLOAD_RETRY_CONFIG;
  if (failedAttemptCount < quickAttemptCount) {
    return quickRetryDelayMs;
  }
  const backoffIndex = failedAttemptCount - quickAttemptCount;
  if (backoffIndex < 0) return quickRetryDelayMs;
  return backoffDelaysMs[Math.min(backoffIndex, backoffDelaysMs.length - 1)] ?? backoffCapMs;
}
