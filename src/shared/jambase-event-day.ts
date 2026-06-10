/**
 * JamBase `startDate` is venue-local wall time without a timezone offset.
 * Compare calendar days using `location.address['x-timezone']`, not UTC parsing.
 */

export function jamBaseEventLocalYmd(startDate: string): string | null {
  const m = startDate.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function jamBaseVenueTimezone(ev: Record<string, unknown>): string {
  const loc = ev.location as Record<string, unknown> | undefined;
  const addr = (loc?.address ?? ev.address) as Record<string, unknown> | undefined;
  if (addr) {
    const tz = addr['x-timezone'] ?? addr.xTimezone;
    if (typeof tz === 'string' && tz.trim()) return tz.trim();
  }
  return 'UTC';
}

export function ymdInTimeZone(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  } catch {
    return ymdUtc(ms);
  }
}

export function ymdUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** True when capture instant is on the same venue-local calendar day as the event. */
export function jamBaseEventOnCaptureDay(ev: Record<string, unknown>, captureMs: number): boolean {
  const sd = typeof ev.startDate === 'string' ? ev.startDate : '';
  const eventYmd = jamBaseEventLocalYmd(sd);
  if (!eventYmd) return false;
  const tz = jamBaseVenueTimezone(ev);
  const captureYmd = ymdInTimeZone(captureMs, tz);
  return eventYmd === captureYmd;
}
