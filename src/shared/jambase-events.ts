/** JamBase event JSON (subset used for ticketing + distance). */
export type JamBaseEventRecord = Record<string, unknown>;

import type { ClipShowCandidate } from './types';
import {
  jamBaseEventMatchesCapture,
  jamBaseEventUpcomingOrInProgress,
  jamBaseVenueTimezone,
} from './jambase-event-day';
import { jamBaseEventTitle, artistAtVenueTitle } from './event-title';

const JAMBASE_EVENT_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop';

export function jamBaseEventHeadliner(ev: JamBaseEventRecord): Record<string, unknown> | null {
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

/** Event image URL from JamBase payload (event → venue → headliner), or null if none. */
export function jamBaseEventImageUrl(ev: JamBaseEventRecord): string | null {
  const eventImg = typeof ev.image === 'string' ? ev.image.trim() : '';
  if (eventImg) return eventImg;
  const loc = ev.location as Record<string, unknown> | undefined;
  const venueImg = typeof loc?.image === 'string' ? loc.image.trim() : '';
  if (venueImg) return venueImg;
  const head = jamBaseEventHeadliner(ev);
  const artistImg = typeof head?.image === 'string' ? head.image.trim() : '';
  if (artistImg) return artistImg;
  return null;
}

/** Same priority as `jamBaseEventImageUrl` with a stock concert photo fallback. */
export function jamBaseEventCardImageUrl(ev: JamBaseEventRecord): string {
  return jamBaseEventImageUrl(ev) ?? JAMBASE_EVENT_IMAGE_FALLBACK;
}

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function jamBaseEventVenueCoords(ev: JamBaseEventRecord): { lat: number; lon: number } | null {
  const loc = ev.location as Record<string, unknown> | undefined;
  if (loc) {
    const geo = loc.geo as Record<string, unknown> | undefined;
    if (geo) {
      const lat = Number(geo.latitude ?? geo.lat);
      const lon = Number(geo.longitude ?? geo.lon ?? geo.lng);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    const addr = loc.address as Record<string, unknown> | undefined;
    if (addr) {
      const ag = addr.geo as Record<string, unknown> | undefined;
      if (ag) {
        const lat = Number(ag.latitude ?? ag.lat);
        const lon = Number(ag.longitude ?? ag.lon ?? ag.lng);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
      }
    }
    const latLoc = Number(loc.latitude ?? loc.lat);
    const lonLoc = Number(loc.longitude ?? loc.lon ?? loc.lng);
    if (Number.isFinite(latLoc) && Number.isFinite(lonLoc)) return { lat: latLoc, lon: lonLoc };
  }
  const rootGeo = ev.geo as Record<string, unknown> | undefined;
  if (rootGeo) {
    const lat = Number(rootGeo.latitude ?? rootGeo.lat);
    const lon = Number(rootGeo.longitude ?? rootGeo.lon ?? rootGeo.lng);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const rlat = Number(ev.latitude);
  const rlon = Number(ev.longitude);
  if (Number.isFinite(rlat) && Number.isFinite(rlon)) return { lat: rlat, lon: rlon };
  return null;
}

export function jamBaseEventStartMs(ev: JamBaseEventRecord): number | null {
  const start = typeof ev.startDate === 'string' ? ev.startDate : null;
  if (!start) return null;
  const ms = Date.parse(start);
  return Number.isFinite(ms) ? ms : null;
}

export function jamBaseEventVenueName(ev: JamBaseEventRecord): string {
  const loc = ev.location as Record<string, unknown> | undefined;
  return typeof loc?.name === 'string' ? loc.name : 'Venue TBA';
}

export function jamBaseEventVenueCityLine(ev: JamBaseEventRecord): string {
  const loc = ev.location as Record<string, unknown> | undefined;
  const addr = loc?.address as Record<string, unknown> | undefined;
  const city = typeof addr?.addressLocality === 'string' ? addr.addressLocality : '';
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const st =
    typeof region?.alternateName === 'string'
      ? region.alternateName
      : typeof region?.name === 'string'
        ? (region.name as string)
        : '';
  return [city, st].filter(Boolean).join(', ');
}

export function formatJamBaseEventDate(iso?: string | null): string {
  if (!iso) return 'Date TBA';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'Date TBA';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatJamBaseEventTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function isJamBaseEventOnOrAfterToday(ev: JamBaseEventRecord, now = new Date()): boolean {
  return jamBaseEventUpcomingOrInProgress(ev, now.getTime());
}

/** Primary ticketing URL from JamBase offers, else event page URL. */
export function jamBaseEventTicketUrl(ev: JamBaseEventRecord): string | null {
  const offers = ev.offers;
  if (Array.isArray(offers) && offers.length > 0) {
    const primary = offers.find(
      (o: unknown) =>
        typeof o === 'object' &&
        o !== null &&
        (o as Record<string, unknown>).category === 'ticketingLinkPrimary',
    ) as Record<string, unknown> | undefined;
    const url = (primary?.url ?? (offers[0] as Record<string, unknown>)?.url) as string | undefined;
    if (typeof url === 'string' && url.length > 0) return url;
  }
  const page = typeof ev.url === 'string' ? ev.url : null;
  return page && page.length > 0 ? page : null;
}

/** Map a JamBase geo `/events` row to a clip candidate (no capture-day filter). */
export function clipCandidateFromJamBaseEventLoose(
  ev: JamBaseEventRecord,
  userLat: number,
  userLon: number,
  maxDistanceMiles?: number,
): ClipShowCandidate | null {
  const eventId = typeof ev.identifier === 'string' ? ev.identifier : null;
  if (!eventId) return null;

  const head = jamBaseEventHeadliner(ev);
  const artistName = typeof head?.name === 'string' ? head.name : null;
  const artistId = typeof head?.identifier === 'string' ? head.identifier : null;
  const loc = ev.location as Record<string, unknown> | undefined;
  const venueName = typeof loc?.name === 'string' ? loc.name : null;
  const venueId = typeof loc?.identifier === 'string' ? loc.identifier : null;
  const locationLine = jamBaseEventVenueCityLine(ev) || null;
  const startDate = typeof ev.startDate === 'string' ? ev.startDate : '';
  const eventTitle = jamBaseEventTitle(ev) ?? artistAtVenueTitle(artistName, venueName);

  const coords = jamBaseEventVenueCoords(ev);
  let distanceMiles: number | null = null;
  if (coords) {
    distanceMiles = haversineMiles(userLat, userLon, coords.lat, coords.lon);
    if (maxDistanceMiles != null && distanceMiles > maxDistanceMiles) return null;
  }

  if (!venueName && !venueId) return null;

  return {
    jambase_event_id: eventId,
    jambase_artist_id: artistId,
    jambase_venue_id: venueId,
    artist_name: artistName,
    venue_name: venueName,
    location: locationLine,
    event_title: eventTitle,
    startDate,
    distance_miles: distanceMiles,
    venue_timezone: jamBaseVenueTimezone(ev, userLat, userLon),
  };
}

/** Map JamBase events → clip candidates; set `loose` for camera (date filter applied later). */
export function clipCandidatesFromJamBaseEvents(
  events: JamBaseEventRecord[],
  userLat: number,
  userLon: number,
  captureMs: number,
  maxDistanceMiles?: number,
  opts?: { loose?: boolean },
): ClipShowCandidate[] {
  const out: ClipShowCandidate[] = [];
  for (const ev of events) {
    if (typeof ev !== 'object' || ev === null) continue;
    const cnd = opts?.loose
      ? clipCandidateFromJamBaseEventLoose(ev, userLat, userLon, maxDistanceMiles)
      : clipCandidateFromJamBaseEvent(ev, userLat, userLon, captureMs, maxDistanceMiles);
    if (cnd) out.push(cnd);
  }
  return out;
}

/** Map a JamBase geo `/events` row to a clip resolve candidate (same-day capture only). */
export function clipCandidateFromJamBaseEvent(
  ev: JamBaseEventRecord,
  userLat: number,
  userLon: number,
  captureMs: number,
  maxDistanceMiles?: number,
): ClipShowCandidate | null {
  if (!jamBaseEventMatchesCapture(ev, captureMs, userLat, userLon)) return null;
  return clipCandidateFromJamBaseEventLoose(ev, userLat, userLon, maxDistanceMiles);
}

export type JamBaseShowPick = {
  event: JamBaseEventRecord;
  ticketUrl: string;
};

/**
 * Closest upcoming show with a ticket URL when user coords exist;
 * otherwise the soonest upcoming show by date.
 */
export function pickClosestUpcomingJamBaseShow(
  events: JamBaseEventRecord[],
  userLat?: number | null,
  userLon?: number | null,
): JamBaseShowPick | null {
  const eligible = events
    .filter((e) => isJamBaseEventOnOrAfterToday(e))
    .map((e) => {
      const ticketUrl = jamBaseEventTicketUrl(e);
      return ticketUrl ? { event: e, ticketUrl } : null;
    })
    .filter((x): x is JamBaseShowPick => x != null);

  if (eligible.length === 0) return null;

  if (userLat != null && userLon != null && Number.isFinite(userLat) && Number.isFinite(userLon)) {
    const ranked = eligible
      .map((row) => {
        const coords = jamBaseEventVenueCoords(row.event);
        const dist = coords
          ? haversineMiles(userLat, userLon, coords.lat, coords.lon)
          : Number.POSITIVE_INFINITY;
        return { ...row, dist };
      })
      .sort((a, b) => a.dist - b.dist);
    return ranked[0] ?? null;
  }

  const byDate = [...eligible].sort(
    (a, b) => (jamBaseEventStartMs(a.event) ?? 0) - (jamBaseEventStartMs(b.event) ?? 0),
  );
  return byDate[0] ?? null;
}
