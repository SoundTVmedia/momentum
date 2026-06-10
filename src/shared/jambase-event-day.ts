/**
 * JamBase `startDate` is venue-local wall time without a timezone offset.
 * Compare calendar days using `location.address['x-timezone']`, not UTC parsing.
 */

export function jamBaseEventLocalYmd(startDate: string): string | null {
  const m = startDate.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Rough US timezone from GPS when JamBase omits `x-timezone` on the venue. */
export function inferTimezoneFromCoords(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 24.5 || lat > 49.5 || lon < -125 || lon > -66) return null;
  if (lon < -115) return 'America/Los_Angeles';
  if (lon < -105) return 'America/Denver';
  if (lon < -90) return 'America/Chicago';
  return 'America/New_York';
}

export function jamBaseVenueTimezone(
  ev: Record<string, unknown>,
  userLat?: number,
  userLon?: number,
): string {
  const loc = ev.location as Record<string, unknown> | undefined;
  const addr = (loc?.address ?? ev.address) as Record<string, unknown> | undefined;
  if (addr) {
    const tz = addr['x-timezone'] ?? addr.xTimezone;
    if (typeof tz === 'string' && tz.trim()) return tz.trim();
  }
  if (userLat != null && userLon != null) {
    const inferred = inferTimezoneFromCoords(userLat, userLon);
    if (inferred) return inferred;
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

export function hourInTimeZone(ms: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date(ms));
    const h = parts.find((p) => p.type === 'hour')?.value;
    if (h != null) return parseInt(h, 10) % 24;
  } catch {
    /* fall through */
  }
  return new Date(ms).getUTCHours();
}

export function ymdUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetweenYmd(eventYmd: string, captureYmd: string): number {
  const eventMs = Date.parse(`${eventYmd}T12:00:00Z`);
  const captureMs = Date.parse(`${captureYmd}T12:00:00Z`);
  if (!Number.isFinite(eventMs) || !Number.isFinite(captureMs)) return 0;
  return Math.round((captureMs - eventMs) / (86400 * 1000));
}

function eventWallClockHour(startDate: string): number {
  const m = startDate.match(/T(\d{2}):/);
  return m ? parseInt(m[1], 10) : 20;
}

/**
 * True when capture instant is on the same venue-local calendar day as the event,
 * including late-night shows that cross midnight (e.g. 8pm show, 1am capture).
 */
export function jamBaseEventMatchesCapture(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  const sd = typeof ev.startDate === 'string' ? ev.startDate : '';
  const eventYmd = jamBaseEventLocalYmd(sd);
  if (!eventYmd) return false;

  const tz = jamBaseVenueTimezone(ev, userLat, userLon);
  const captureYmd = ymdInTimeZone(captureMs, tz);
  if (eventYmd === captureYmd) return true;

  const dayDiff = daysBetweenYmd(eventYmd, captureYmd);
  const eventHour = eventWallClockHour(sd);
  const captureHour = hourInTimeZone(captureMs, tz);

  // After-midnight capture while the show started the previous evening.
  if (dayDiff === 1 && eventHour >= 17 && captureHour < 8) return true;

  // Early-morning listing on the next calendar day while still at a late show.
  if (dayDiff === -1 && eventHour <= 6 && captureHour >= 20) return true;

  return false;
}

/** True when capture instant is on the same venue-local calendar day as the event. */
export function jamBaseEventOnCaptureDay(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  return jamBaseEventMatchesCapture(ev, captureMs, userLat, userLon);
}
