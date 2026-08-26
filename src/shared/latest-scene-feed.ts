/** Prefer clips posted within 24 hours of the associated JamBase event. */
export const LATEST_SCENE_PREFERRED_AGE_MS = 24 * 60 * 60 * 1000;

/** Latest fallback: clips posted within 30 days of the associated JamBase event. */
export const LATEST_SCENE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether a clip belongs in the home Latest grid.
 * Unmatched clips stay in Latest. Tagged clips qualify only if they were posted
 * within `maxAgeMs` of the show start — not merely because the upload is recent.
 */
export function clipQualifiesForLatestScene(opts: {
  nowMs?: number;
  showStartAt?: string | null;
  createdAt?: string | null;
  maxAgeMs?: number;
}): boolean {
  const raw = opts.showStartAt?.trim();
  if (!raw) return true;
  const showAt = Date.parse(raw);
  if (!Number.isFinite(showAt)) return true;
  const createdRaw = opts.createdAt?.trim();
  const postedAt = createdRaw
    ? Date.parse(createdRaw)
    : (opts.nowMs ?? Date.now());
  if (!Number.isFinite(postedAt)) return true;
  const maxAge = opts.maxAgeMs ?? LATEST_SCENE_MAX_AGE_MS;
  return postedAt - showAt <= maxAge;
}
