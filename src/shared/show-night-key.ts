/** UTC calendar day prefix from an ISO or SQLite timestamp. */
export function showCalendarDay(startDate: string | null | undefined): string | null {
  return (startDate ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

/** Whole UTC days between two timestamps, or null when either date is missing. */
export function showCalendarDaysApart(
  left: string | null | undefined,
  right: string | null | undefined,
): number | null {
  const a = showCalendarDay(left);
  const b = showCalendarDay(right);
  if (!a || !b) return null;
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.abs(ms) / 86_400_000;
}

/** Same-concert-night identity used to merge clips and library stubs. */
export function showNightKey(
  artistName: string | null | undefined,
  venueName: string | null | undefined,
  startDate: string | null | undefined,
): string | null {
  const artist = (artistName ?? '').trim().toLowerCase();
  const venue = (venueName ?? '')
    .trim()
    .replace(/['\u2019]/g, '')
    .toLowerCase();
  const ymd = showCalendarDay(startDate);
  if (!artist || !venue || !ymd) return null;
  return `${artist}|${venue}|${ymd}`;
}
