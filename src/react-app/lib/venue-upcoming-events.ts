import type { JamBaseEventGridProps } from '@/react-app/components/JamBaseEventGrid';

export type VenueUpcomingRow = {
  id: number;
  artist_id: number;
  venue_id: number;
  date: string;
  city: string | null;
  country: string | null;
  ticket_url: string | null;
  artist_name: string | null;
  artist_image: string | null;
};

type VenueInfo = {
  name: string;
  location: string | null;
  image_url: string | null;
};

/** Map local tour-date rows into JamBase-shaped events for `JamBaseEventGrid` carousel cards. */
export function venueUpcomingRowToJamBaseEvent(
  event: VenueUpcomingRow,
  venue: VenueInfo,
  index: number,
): Record<string, unknown> {
  const artistName = event.artist_name?.trim() || null;
  const ticket = event.ticket_url?.trim() || null;
  return {
    identifier: `venue-local:${event.id}:${index}`,
    name: artistName ? `${artistName} at ${venue.name}` : `Show at ${venue.name}`,
    startDate: event.date,
    image: event.artist_image ?? venue.image_url ?? undefined,
    url: ticket ?? undefined,
    performer: artistName
      ? [
          {
            name: artistName,
            image: event.artist_image ?? undefined,
            'x-isHeadliner': true,
          },
        ]
      : [],
    location: {
      name: venue.name,
      image: venue.image_url ?? undefined,
      address: {
        addressLocality: event.city ?? venue.location ?? undefined,
        addressCountry: event.country ? { alternateName: event.country } : undefined,
      },
    },
    offers: ticket ? [{ url: ticket, category: 'ticketingLinkPrimary' }] : [],
  };
}

export function venueUpcomingCarouselProps(
  venue: VenueInfo,
  upcomingEvents: VenueUpcomingRow[],
  upcomingJamBaseEvents: Record<string, unknown>[] | null | undefined,
  maxEvents = 24,
): Pick<JamBaseEventGridProps, 'preloadedEvents' | 'venueName' | 'maxEvents'> {
  if (upcomingJamBaseEvents?.length) {
    return {
      preloadedEvents: upcomingJamBaseEvents.slice(0, maxEvents),
      maxEvents,
    };
  }
  if (upcomingEvents.length > 0) {
    return {
      preloadedEvents: upcomingEvents.map((e, i) =>
        venueUpcomingRowToJamBaseEvent(e, venue, i),
      ),
      maxEvents,
    };
  }
  return {
    venueName: venue.name,
    maxEvents,
  };
}
