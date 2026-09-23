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

function showClockHour(value: string | null | undefined): number | null {
  const hour = Number((value ?? '').trim().match(/T(\d{2})/)?.[1]);
  return Number.isFinite(hour) ? hour : null;
}

/**
 * Same concert night, including a listing that spills across UTC midnight.
 * Two evening shows on back-to-back dates stay separate (a residency).
 */
export function sameConcertNight(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const days = showCalendarDaysApart(left, right);
  if (days === 0) return true;
  if (days !== 1) return false;
  const leftHour = showClockHour(left);
  const rightHour = showClockHour(right);
  if (leftHour == null || rightHour == null) return false;
  const late = (hour: number) => hour >= 18;
  const early = (hour: number) => hour < 6;
  return (late(leftHour) && early(rightHour)) || (early(leftHour) && late(rightHour));
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
