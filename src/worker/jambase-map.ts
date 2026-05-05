function primaryTicketUrl(ev: Record<string, unknown>): string | null {
  const offers = ev.offers;
  if (!Array.isArray(offers) || offers.length === 0) return null;
  const primary = offers.find(
    (o: unknown) =>
      typeof o === 'object' &&
      o !== null &&
      (o as Record<string, unknown>).category === 'ticketingLinkPrimary'
  ) as Record<string, unknown> | undefined;
  const url = (primary?.url ?? (offers[0] as Record<string, unknown>)?.url) as string | undefined;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function stableNegativeId(identifier: string, fallback: number): number {
  let h = 0;
  for (let i = 0; i < identifier.length; i++) {
    h = (Math.imul(31, h) + identifier.charCodeAt(i)) | 0;
  }
  if (h >= 0) h = -h - 1;
  return h || -fallback - 1;
}

/** Map JamBase Concert event → artist_tour_dates-shaped row for ArtistPage */
export function jamBaseEventToTourDateRow(
  ev: Record<string, unknown>,
  localArtistId: number,
  index: number
): Record<string, unknown> {
  const loc = ev.location as Record<string, unknown> | undefined;
  const addr = loc?.address as Record<string, unknown> | undefined;
  const region = addr?.addressRegion as Record<string, unknown> | undefined;
  const country = addr?.addressCountry as Record<string, unknown> | undefined;
  const city = typeof addr?.addressLocality === 'string' ? addr.addressLocality : null;
  const regionName =
    typeof region?.name === 'string'
      ? region.name
      : typeof region?.alternateName === 'string'
        ? (region.alternateName as string)
        : null;
  const countryName =
    typeof country?.alternateName === 'string'
      ? country.alternateName
      : typeof country?.name === 'string'
        ? (country.name as string)
        : null;
  const venueName = typeof loc?.name === 'string' ? loc.name : null;
  const venueLocation = [city, regionName].filter(Boolean).join(', ') || null;
  const idStr = typeof ev.identifier === 'string' ? ev.identifier : `idx:${index}`;
  const ticket = primaryTicketUrl(ev);
  const eventPage =
    typeof ev.url === 'string' && ev.url.includes('jambase.com') ? ev.url : null;
  return {
    id: stableNegativeId(idStr, index),
    artist_id: localArtistId,
    venue_id: null,
    date: typeof ev.startDate === 'string' ? ev.startDate : '',
    city,
    country: countryName,
    ticket_url: ticket ?? eventPage,
    venue_name: venueName,
    venue_location: venueLocation,
    created_at: '',
    updated_at: '',
  };
}

/** Headliner from performer list */
export function headlinerFromEvent(ev: Record<string, unknown>): Record<string, unknown> | null {
  const perf = ev.performer;
  if (!Array.isArray(perf) || perf.length === 0) return null;
  const head = perf.find(
    (p: unknown) =>
      typeof p === 'object' &&
      p !== null &&
      (p as Record<string, unknown>)['x-isHeadliner'] === true
  );
  const pick = head ?? perf[0];
  return typeof pick === 'object' && pick !== null ? (pick as Record<string, unknown>) : null;
}

/** Map JamBase event → venue upcomingEvents-shaped row for VenuePage */
export function jamBaseEventToVenueUpcomingRow(
  ev: Record<string, unknown>,
  localVenueId: number,
  index: number
): Record<string, unknown> {
  const head = headlinerFromEvent(ev);
  const artistName = typeof head?.name === 'string' ? head.name : null;
  const artistImage = typeof head?.image === 'string' ? head.image : null;
  const addr = (ev.location as Record<string, unknown> | undefined)?.address as
    | Record<string, unknown>
    | undefined;
  const country = addr?.addressCountry as Record<string, unknown> | undefined;
  const city = typeof addr?.addressLocality === 'string' ? addr.addressLocality : null;
  const countryName =
    typeof country?.alternateName === 'string'
      ? country.alternateName
      : typeof country?.name === 'string'
        ? (country.name as string)
        : null;
  const idStr = typeof ev.identifier === 'string' ? ev.identifier : `idx:${index}`;
  const ticket = primaryTicketUrl(ev);
  const eventPage =
    typeof ev.url === 'string' && ev.url.includes('jambase.com') ? ev.url : null;
  return {
    id: stableNegativeId(idStr, index),
    artist_id: 0,
    venue_id: localVenueId,
    date: typeof ev.startDate === 'string' ? ev.startDate : '',
    city,
    country: countryName,
    ticket_url: ticket ?? eventPage,
    artist_name: artistName,
    artist_image: artistImage,
    created_at: '',
    updated_at: '',
  };
}
