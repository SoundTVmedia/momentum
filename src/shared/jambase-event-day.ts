/**
 * JamBase `startDate` is venue-local wall time without a timezone offset.
 * Compare calendar days using `location.address['x-timezone']`, not UTC parsing.
 */

/** Include captures up to this many hours after `startDate` while the show is still in progress. */
export const JAMBASE_EVENT_ONGOING_HOURS_AFTER_START = 4;

/** Camera capture: max hours after start to still match an in-progress show on the current date. */
export const JAMBASE_CAMERA_EVENT_MAX_HOURS_AFTER_START = 10;

/** Look back this many hours before capture when resolving in-show listings at a venue. */
export const JAMBASE_EVENT_IN_SHOW_LOOKBACK_HOURS = 10;

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

/** `eventDateFrom` for venue-scoped lookups that include in-progress shows (expandPastEvents). */
export function jamBaseVenueEventLookbackDateFrom(captureMs: number = Date.now()): string {
  const todayUtc = ymdUtc(captureMs);
  const win = new Date(captureMs);
  win.setUTCDate(win.getUTCDate() - 1);
  const tentative = ymdUtc(win.getTime());
  return tentative < todayUtc ? todayUtc : tentative;
}

/**
 * Earliest allowed `eventDateFrom` for JamBase geo `/events` (HTTP 400 if before UTC today).
 * May look back one UTC day when capture is shortly after UTC midnight.
 */
export function jamBaseGeoEventDateFromUtc(anchorMs: number = Date.now()): string {
  return jamBaseVenueEventLookbackDateFrom(anchorMs);
}

/** Venue-local calendar day for the capture instant (for eventDateFrom when coords are known). */
export function jamBaseEventDateFromCaptureLocal(
  captureMs: number,
  userLat: number,
  userLon: number,
): string {
  const tz = inferTimezoneFromCoords(userLat, userLon) ?? 'UTC';
  return ymdInTimeZone(captureMs, tz);
}

/** Safe `eventDateFrom` for venue expandPastEvents: prefer venue-local capture day. */
export function jamBaseVenueEventDateFromForExpandPast(
  captureMs: number,
  userLat: number,
  userLon: number,
): string {
  return jamBaseEventDateFromCaptureLocal(captureMs, userLat, userLon);
}

/** Date strings to try for venue-scoped expandPastEvents (local day first). */
export function jamBaseVenueExpandPastEventDateCandidates(
  captureMs: number,
  userLat: number,
  userLon: number,
): string[] {
  const tz = inferTimezoneFromCoords(userLat, userLon) ?? 'UTC';
  const local = ymdInTimeZone(captureMs, tz);
  const localPrev = ymdInTimeZone(captureMs - 86400000, tz);
  const utc = jamBaseGeoEventDateFromUtc(captureMs);
  return [...new Set([local, localPrev, utc])].sort();
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

function parseLocalPartsInTimeZone(
  ms: number,
  timeZone: string,
): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    y: parseInt(get('year'), 10),
    mo: parseInt(get('month'), 10),
    d: parseInt(get('day'), 10),
    h: parseInt(get('hour'), 10) % 24,
    mi: parseInt(get('minute'), 10),
    s: parseInt(get('second'), 10),
  };
}

/** UTC epoch for JamBase `startDate` interpreted as venue-local wall time. */
export function jamBaseEventStartMs(
  ev: Record<string, unknown>,
  userLat?: number,
  userLon?: number,
): number | null {
  const sd = typeof ev.startDate === 'string' ? ev.startDate.trim() : '';
  const m = sd.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;

  const desired = {
    y: parseInt(m[1], 10),
    mo: parseInt(m[2], 10),
    d: parseInt(m[3], 10),
    h: parseInt(m[4], 10),
    mi: parseInt(m[5], 10),
    s: m[6] ? parseInt(m[6], 10) : 0,
  };
  const tz = jamBaseVenueTimezone(ev, userLat, userLon);
  let utcMs = Date.UTC(desired.y, desired.mo - 1, desired.d, desired.h, desired.mi, desired.s);
  for (let i = 0; i < 4; i++) {
    const actual = parseLocalPartsInTimeZone(utcMs, tz);
    const desiredMs = Date.UTC(
      desired.y,
      desired.mo - 1,
      desired.d,
      desired.h,
      desired.mi,
      desired.s,
    );
    const actualMs = Date.UTC(actual.y, actual.mo - 1, actual.d, actual.h, actual.mi, actual.s);
    utcMs += desiredMs - actualMs;
  }
  return utcMs;
}

/** Hours from event `startDate` to capture (positive = after doors). */
export function jamBaseEventHoursFromStart(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): number | null {
  const startMs = jamBaseEventStartMs(ev, userLat, userLon);
  if (startMs == null || !Number.isFinite(startMs)) return null;
  return (captureMs - startMs) / (3600 * 1000);
}

/** True when capture falls during the in-progress show window after start time. */
export function jamBaseEventOngoingAtCapture(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  const hours = jamBaseEventHoursFromStart(ev, captureMs, userLat, userLon);
  if (hours == null) return false;
  return hours >= -1 && hours <= JAMBASE_EVENT_ONGOING_HOURS_AFTER_START;
}

function jamBaseEventSameShowNight(
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

/** True when the event `startDate` calendar day equals the capture calendar day (venue-local). */
export function jamBaseEventSameCalendarDay(
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
  return eventYmd === captureYmd;
}

/**
 * Camera venue picker: same venue-local calendar day, including shows that already started
 * today (via expandPastEvents) up to {@link JAMBASE_CAMERA_EVENT_MAX_HOURS_AFTER_START}h after start.
 */
export function jamBaseEventCameraCaptureDay(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  if (!jamBaseEventSameCalendarDay(ev, captureMs, userLat, userLon)) return false;
  const hours = jamBaseEventHoursFromStart(ev, captureMs, userLat, userLon);
  if (hours == null) return true;
  if (hours < 0) return true;
  return hours <= JAMBASE_CAMERA_EVENT_MAX_HOURS_AFTER_START;
}

/** True when doors time has passed (show may be in progress). */
export function jamBaseEventHasStarted(
  ev: Record<string, unknown>,
  nowMs: number = Date.now(),
  userLat?: number,
  userLon?: number,
): boolean {
  const hours = jamBaseEventHoursFromStart(ev, nowMs, userLat, userLon);
  return hours != null && hours >= 0;
}

/**
 * Nearby/event-list feeds: same venue-local calendar day, including shows that already
 * started today up to {@link JAMBASE_EVENT_ONGOING_HOURS_AFTER_START}h after start.
 */
export function jamBaseEventFeedVisible(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  if (jamBaseEventSameCalendarDay(ev, captureMs, userLat, userLon)) {
    const hours = jamBaseEventHoursFromStart(ev, captureMs, userLat, userLon);
    if (hours == null) return true;
    if (hours < 0) return true;
    return hours <= JAMBASE_EVENT_ONGOING_HOURS_AFTER_START;
  }
  return jamBaseEventOngoingAtCapture(ev, captureMs, userLat, userLon);
}

/**
 * Event lists and Going marks: future shows plus today's shows still within
 * {@link JAMBASE_EVENT_ONGOING_HOURS_AFTER_START}h of start (via {@link jamBaseEventFeedVisible}).
 */
export function jamBaseEventUpcomingOrInProgress(
  ev: Record<string, unknown>,
  nowMs: number = Date.now(),
  userLat?: number,
  userLon?: number,
): boolean {
  if (jamBaseEventFeedVisible(ev, nowMs, userLat, userLon)) return true;
  const startMs = jamBaseEventStartMs(ev, userLat, userLon);
  if (startMs == null) return true;
  return startMs > nowMs;
}

/**
 * True when capture instant is on the same venue-local calendar day as the event,
 * including late-night shows that cross midnight (e.g. 8pm show, 1am capture),
 * or while the show is still in progress after start time.
 */
export function jamBaseEventMatchesCapture(
  ev: Record<string, unknown>,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  if (jamBaseEventSameShowNight(ev, captureMs, userLat, userLon)) return true;
  return jamBaseEventOngoingAtCapture(ev, captureMs, userLat, userLon);
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
