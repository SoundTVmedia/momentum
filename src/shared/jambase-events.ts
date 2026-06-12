/** JamBase event JSON (subset used for ticketing + distance). */
export type JamBaseEventRecord = Record<string, unknown>;

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
  const ms = jamBaseEventStartMs(ev);
  if (ms === null) return true;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const eventDay = new Date(ms);
  const eventDayStart = new Date(
    eventDay.getFullYear(),
    eventDay.getMonth(),
    eventDay.getDate(),
  ).getTime();
  return eventDayStart >= todayStart;
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
