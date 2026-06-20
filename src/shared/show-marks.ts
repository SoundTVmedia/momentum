import type { ClipShowCandidate } from './types';
import { jamBaseEventMatchesCapture, jamBaseEventSameCalendarDay } from './jambase-event-day';
import { isJamBaseEventOnOrAfterToday } from './jambase-events';
import { computeShowId } from './show-id';

export type ShowMarkStatus = 'going' | 'attended';

export type UserShowMark = {
  id: number;
  status: ShowMarkStatus;
  jambase_event_id: string;
  jambase_venue_id: string | null;
  jambase_artist_id: string | null;
  event_title: string | null;
  artist_name: string | null;
  venue_name: string | null;
  venue_location: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
};

export type FriendGoingPlan = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  mark: UserShowMark;
};

export type ShowMarkUpsertInput = {
  status: ShowMarkStatus;
  jambase_event_id: string;
  jambase_venue_id?: string | null;
  jambase_artist_id?: string | null;
  event_title?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  venue_location?: string | null;
  start_date?: string | null;
};

function headlinerFromJamBaseEvent(ev: Record<string, unknown>): Record<string, unknown> | null {
  const perf = ev.performer;
  if (!Array.isArray(perf) || perf.length === 0) return null;
  const head = perf.find(
    (p: unknown) =>
      typeof p === 'object' &&
      p !== null &&
      (p as Record<string, unknown>)['x-isHeadliner'] === true,
  );
  const pick = head ?? perf[0];
  return typeof pick === 'object' && pick !== null ? (pick as Record<string, unknown>) : null;
}

export type PastShowMarkSource = {
  event_title: string;
  artist_name: string;
  show_date: string;
  venue_name?: string | null;
  venue_location?: string | null;
  jambase_event_id?: string | null;
  jambase_venue_id?: string | null;
  jambase_artist_id?: string | null;
};

/** Build a JamBase-shaped event from a past-show card or clip row (for Went button). */
export function pastShowSummaryToJamBaseEvent(
  show: PastShowMarkSource,
): Record<string, unknown> | null {
  const eventId =
    (typeof show.jambase_event_id === 'string' ? show.jambase_event_id.trim() : '') ||
    computeShowId({
      jambase_event_id: show.jambase_event_id,
      artist_name: show.artist_name,
      venue_name: show.venue_name,
      timestamp: show.show_date,
    });
  if (!eventId) return null;

  const artistName = show.artist_name?.trim();
  const performers = artistName
    ? [
        {
          name: artistName,
          identifier: show.jambase_artist_id?.trim() || undefined,
          'x-isHeadliner': true,
        },
      ]
    : [];

  const locality = show.venue_location?.split(',')[0]?.trim();
  const regionPart = show.venue_location?.includes(',')
    ? show.venue_location.split(',')[1]?.trim()
    : null;

  return {
    identifier: eventId,
    name: show.event_title?.trim() || 'Show',
    startDate: show.show_date,
    performer: performers,
    location: {
      name: show.venue_name?.trim() || undefined,
      identifier: show.jambase_venue_id?.trim() || undefined,
      address:
        locality || regionPart
          ? {
              addressLocality: locality ?? undefined,
              addressRegion: regionPart ? { alternateName: regionPart } : undefined,
            }
          : undefined,
    },
  };
}

/** Build a show-mark payload from a JamBase event JSON object. */
export function jamBaseEventToShowMarkInput(
  ev: Record<string, unknown>,
  status: ShowMarkStatus,
): ShowMarkUpsertInput | null {
  const eventId = typeof ev.identifier === 'string' ? ev.identifier.trim() : '';
  if (!eventId) return null;

  const head = headlinerFromJamBaseEvent(ev);
  const artistName = typeof head?.name === 'string' ? head.name.trim() : null;
  const artistId = typeof head?.identifier === 'string' ? head.identifier.trim() : null;

  const loc = ev.location as Record<string, unknown> | undefined;
  const venueName = typeof loc?.name === 'string' ? loc.name.trim() : null;
  const venueId = typeof loc?.identifier === 'string' ? loc.identifier.trim() : null;
  const addr = loc?.address as Record<string, unknown> | undefined;
  const city = typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const st =
    typeof region?.alternateName === 'string'
      ? region.alternateName
      : typeof region?.name === 'string'
        ? (region.name as string)
        : '';
  const venueLocation = [city, st].filter(Boolean).join(', ') || null;

  const eventTitle = typeof ev.name === 'string' ? ev.name.trim() : null;
  const startDate = typeof ev.startDate === 'string' ? ev.startDate : null;

  return {
    status,
    jambase_event_id: eventId,
    jambase_venue_id: venueId,
    jambase_artist_id: artistId,
    event_title: eventTitle,
    artist_name: artistName,
    venue_name: venueName,
    venue_location: venueLocation,
    start_date: startDate,
  };
}

/** JamBase-shaped event for grids/carousels from a stored mark. */
export function showMarkToJamBaseEvent(mark: UserShowMark): Record<string, unknown> {
  const performers =
    mark.artist_name?.trim()
      ? [
          {
            name: mark.artist_name,
            identifier: mark.jambase_artist_id ?? undefined,
            'x-isHeadliner': true,
          },
        ]
      : [];

  const locality = mark.venue_location?.split(',')[0]?.trim();
  const regionPart = mark.venue_location?.includes(',')
    ? mark.venue_location.split(',')[1]?.trim()
    : null;

  return {
    identifier: mark.jambase_event_id,
    name:
      mark.event_title?.trim() ||
      [mark.artist_name, mark.venue_name].filter(Boolean).join(' at ') ||
      'Show',
    startDate: mark.start_date ?? undefined,
    performer: performers,
    location: {
      name: mark.venue_name ?? undefined,
      identifier: mark.jambase_venue_id ?? undefined,
      address:
        locality || regionPart
          ? {
              addressLocality: locality ?? undefined,
              addressRegion: regionPart ? { alternateName: regionPart } : undefined,
            }
          : undefined,
    },
  };
}

/** Prefer JamBase API event payload (images, offers) with mark ids as fallback. */
export function mergeJamBaseEventWithShowMark(
  mark: UserShowMark,
  jbEvent: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const fallback = showMarkToJamBaseEvent(mark);
  if (!jbEvent || typeof jbEvent !== 'object') return fallback;
  return {
    ...jbEvent,
    identifier: mark.jambase_event_id,
    name:
      (typeof jbEvent.name === 'string' && jbEvent.name.trim()) ||
      fallback.name,
    startDate:
      (typeof jbEvent.startDate === 'string' && jbEvent.startDate) ||
      mark.start_date ||
      undefined,
  };
}

/** Map enriched JamBase events to marks (API returns both arrays in the same order). */
export function enrichedEventsByMarkId(
  marks: UserShowMark[],
  enriched: Record<string, unknown>[] | undefined,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(enriched)) return map;

  const len = Math.min(marks.length, enriched.length);
  for (let i = 0; i < len; i++) {
    map.set(marks[i].jambase_event_id, enriched[i]);
  }

  for (const ev of enriched) {
    const id = typeof ev.identifier === 'string' ? ev.identifier.trim() : '';
    if (id && !map.has(id)) map.set(id, ev);
  }

  return map;
}

/** Upcoming going marks as JamBase-shaped carousel events (with images when enriched). */
export function upcomingGoingMarkEvents(
  marks: UserShowMark[],
  enriched: Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  const byId = enrichedEventsByMarkId(marks, enriched);
  return marks
    .filter((m) => isUpcomingShowMark(m))
    .map(
      (mark) =>
        byId.get(mark.jambase_event_id) ?? mergeJamBaseEventWithShowMark(mark, null),
    );
}

/** JamBase event is today or later (no startDate → treat as upcoming). */
export function isUpcomingJamBaseEvent(
  ev: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  return isJamBaseEventOnOrAfterToday(ev, now);
}

/** JamBase event is before today (requires startDate). */
export function isPastJamBaseEvent(ev: Record<string, unknown>, now: Date = new Date()): boolean {
  const start = typeof ev.startDate === 'string' ? ev.startDate.trim() : '';
  if (!start) return false;
  return !isJamBaseEventOnOrAfterToday(ev, now);
}

/** Which mark type is valid for this event date. */
export function allowedShowMarkStatusForEvent(
  ev: Record<string, unknown>,
  now: Date = new Date(),
): ShowMarkStatus | null {
  if (isUpcomingJamBaseEvent(ev, now)) return 'going';
  if (isPastJamBaseEvent(ev, now)) return 'attended';
  return null;
}

export function isUpcomingShowMarkStartDate(
  startDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const sd = startDate?.trim();
  if (!sd) return true;
  return isJamBaseEventOnOrAfterToday({ startDate: sd }, now);
}

/** True for going marks tonight or in the future (includes in-progress shows). */
export function isUpcomingShowMark(mark: UserShowMark, nowMs: number = Date.now()): boolean {
  if (mark.status !== 'going') return false;
  const sd = mark.start_date?.trim();
  if (!sd) return true;
  const ev = { startDate: sd, location: { name: mark.venue_name ?? '' } };
  if (jamBaseEventMatchesCapture(ev, nowMs)) return true;
  const eventMs = Date.parse(sd);
  if (!Number.isFinite(eventMs)) return true;
  return eventMs >= nowMs - 12 * 60 * 60 * 1000;
}

export function showMarkToClipCandidate(mark: UserShowMark): ClipShowCandidate {
  return {
    jambase_event_id: mark.jambase_event_id,
    jambase_artist_id: mark.jambase_artist_id,
    jambase_venue_id: mark.jambase_venue_id,
    artist_name: mark.artist_name,
    venue_name: mark.venue_name,
    location: mark.venue_location,
    event_title: mark.event_title,
    startDate: mark.start_date ?? '',
    distance_miles: null,
  };
}

/** Prefer a "going" mark that matches the capture instant (same show night). */
export function pickGoingShowMarkForCapture(
  marks: UserShowMark[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): UserShowMark | null {
  const going = marks.filter((m) => m.status === 'going');
  if (going.length === 0) return null;

  const matching: UserShowMark[] = [];
  for (const mark of going) {
    const sd = mark.start_date?.trim();
    if (sd) {
      const ev = { startDate: sd, location: { name: mark.venue_name ?? '' } };
      if (
        jamBaseEventMatchesCapture(ev, captureMs, userLat, userLon) ||
        jamBaseEventSameCalendarDay(ev, captureMs, userLat, userLon)
      ) {
        matching.push(mark);
      }
      continue;
    }
    if (isUpcomingShowMark(mark, captureMs)) {
      matching.push(mark);
    }
  }

  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const ta = Date.parse(a.start_date ?? '');
    const tb = Date.parse(b.start_date ?? '');
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    return Math.abs(ta - captureMs) - Math.abs(tb - captureMs);
  });
  return matching[0] ?? null;
}
