/** Latest From the Scene only keeps clips from shows still in the last 24 hours. */
export const LATEST_SCENE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a clip belongs in the home Latest grid.
 * Prefers the associated show start, then recording time, then upload time.
 */
export function clipQualifiesForLatestScene(opts: {
  nowMs?: number;
  showStartAt?: string | null;
  recordedAt?: string | null;
  createdAt?: string | null;
}): boolean {
  const now = opts.nowMs ?? Date.now();
  const raw = [opts.showStartAt, opts.recordedAt, opts.createdAt].find(
    (value) => typeof value === 'string' && value.trim(),
  );
  if (!raw) return true;
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return true;
  return now - at <= LATEST_SCENE_MAX_AGE_MS;
}
