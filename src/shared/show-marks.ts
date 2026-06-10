import type { ClipShowCandidate } from './types';
import { jamBaseEventMatchesCapture } from './jambase-event-day';

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
    if (!mark.start_date?.trim()) continue;
    const ev = { startDate: mark.start_date, location: { name: mark.venue_name ?? '' } };
    if (jamBaseEventMatchesCapture(ev, captureMs, userLat, userLon)) {
      matching.push(mark);
    }
  }

  const pool = matching.length > 0 ? matching : going;
  pool.sort((a, b) => {
    const ta = Date.parse(a.start_date ?? '');
    const tb = Date.parse(b.start_date ?? '');
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return 1;
    if (!Number.isFinite(tb)) return -1;
    return Math.abs(ta - captureMs) - Math.abs(tb - captureMs);
  });
  return pool[0] ?? null;
}
