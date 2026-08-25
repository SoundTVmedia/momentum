/** Latest From the Scene hides clips tagged to a show that started over 24h ago. */
export const LATEST_SCENE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a clip belongs in the home Latest grid.
 * Only the associated show start can disqualify it. Recording/upload time must
 * not put a past-show clip into Latest, and must not hide unmatched clips.
 */
export function clipQualifiesForLatestScene(opts: {
  nowMs?: number;
  showStartAt?: string | null;
}): boolean {
  const raw = opts.showStartAt?.trim();
  if (!raw) return true;
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return true;
  return (opts.nowMs ?? Date.now()) - at <= LATEST_SCENE_MAX_AGE_MS;
}
