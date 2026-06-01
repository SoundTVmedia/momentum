/** Ticketmaster Discovery event shape (subset used in the app). */
export type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
  };
  priceRanges?: { min: number; max: number; currency: string }[];
  _embedded?: {
    venues?: {
      name: string;
      city?: { name: string };
      state?: { stateCode: string };
      location?: { latitude: string; longitude: string };
    }[];
  };
};

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

export function ticketmasterVenueCoords(
  event: TicketmasterEvent,
): { lat: number; lon: number } | null {
  const loc = event._embedded?.venues?.[0]?.location;
  if (!loc) return null;
  const lat = parseFloat(loc.latitude);
  const lon = parseFloat(loc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function ticketmasterEventStartMs(event: TicketmasterEvent): number | null {
  const start = event.dates?.start;
  if (!start) return null;
  if (start.dateTime) {
    const ms = Date.parse(start.dateTime);
    if (Number.isFinite(ms)) return ms;
  }
  const d = start.localDate;
  if (!d) return null;
  const t = start.localTime ?? '12:00:00';
  const ms = Date.parse(`${d}T${t}`);
  return Number.isFinite(ms) ? ms : null;
}

/** Local calendar day of the event is today or later. */
export function isTicketmasterEventOnOrAfterToday(
  event: TicketmasterEvent,
  now = new Date(),
): boolean {
  const ms = ticketmasterEventStartMs(event);
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

/** Nearest upcoming show with a ticket URL, by venue distance from the user. */
export function pickClosestUpcomingTicketmasterEvent(
  events: TicketmasterEvent[],
  userLat: number,
  userLon: number,
): TicketmasterEvent | null {
  const eligible = events.filter((e) => e.url && isTicketmasterEventOnOrAfterToday(e));
  if (eligible.length === 0) return null;

  const ranked = eligible
    .map((e) => {
      const coords = ticketmasterVenueCoords(e);
      const dist = coords
        ? haversineMiles(userLat, userLon, coords.lat, coords.lon)
        : Number.POSITIVE_INFINITY;
      return { e, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  return ranked[0]?.e ?? null;
}

/** First upcoming event with a URL when venue coordinates are unavailable. */
export function pickFirstUpcomingTicketmasterEvent(
  events: TicketmasterEvent[],
): TicketmasterEvent | null {
  return events.find((e) => e.url && isTicketmasterEventOnOrAfterToday(e)) ?? null;
}

export function ticketmasterSearchStartDateIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00Z`;
}

export function ticketmasterSearchEndDateIso(now = new Date(), monthsAhead = 6): string {
  const end = new Date(now);
  end.setMonth(end.getMonth() + monthsAhead);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T23:59:59Z`;
}
