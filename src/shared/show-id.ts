import { slugifyEntityName } from './jambase-slug';

export type ShowIdInput = {
  jambase_event_id?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  timestamp?: string | null;
};

/** UTC calendar day YYYY-MM-DD from an ISO or parseable timestamp. */
export function utcYmdFromTimestamp(timestamp: string): string | null {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Stable show key for grouping clips from the same concert.
 * Prefers JamBase event id; otherwise artist + venue + UTC capture date slug.
 */
export function computeShowId(input: ShowIdInput): string | null {
  const eventId =
    typeof input.jambase_event_id === 'string' ? input.jambase_event_id.trim() : '';
  if (eventId) return eventId;

  const artist = typeof input.artist_name === 'string' ? input.artist_name.trim() : '';
  const venue = typeof input.venue_name === 'string' ? input.venue_name.trim() : '';
  const ts = typeof input.timestamp === 'string' ? input.timestamp.trim() : '';
  if (!artist || !venue || !ts) return null;

  const day = utcYmdFromTimestamp(ts);
  if (!day) return null;

  const artistSlug = slugifyEntityName(artist);
  const venueSlug = slugifyEntityName(venue);
  if (!artistSlug || !venueSlug) return null;

  return `${artistSlug}-${venueSlug}-${day}`;
}
