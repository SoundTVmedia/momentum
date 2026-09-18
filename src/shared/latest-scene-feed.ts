/** Tagged shows in Latest must have happened within the last 30 days. */
export const LATEST_SCENE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether a clip belongs in the home Latest grid.
 * Unmatched clips stay in Latest. Tagged clips qualify only if the associated
 * event happened within `maxAgeMs` of now — not merely because the upload is
 * recent. Late uploads to older past shows still belong on the event page.
 */
export function clipQualifiesForLatestScene(opts: {
  nowMs?: number;
  showStartAt?: string | null;
  maxAgeMs?: number;
}): boolean {
  const now = opts.nowMs ?? Date.now();
  const raw = opts.showStartAt?.trim();
  if (!raw) return true;
  const showAt = Date.parse(raw);
  if (!Number.isFinite(showAt)) return true;
  const maxAge = opts.maxAgeMs ?? LATEST_SCENE_MAX_AGE_MS;
  return now - showAt <= maxAge;
}
