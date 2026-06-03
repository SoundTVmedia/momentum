/** JamBase Concert `name`, e.g. "Don Toliver at Colonial Life Arena". */
export function jamBaseEventTitle(ev: Record<string, unknown>): string | null {
  const name = typeof ev.name === 'string' ? ev.name.trim() : '';
  return name || null;
}

export function artistAtVenueTitle(
  artist: string | null | undefined,
  venue: string | null | undefined,
): string | null {
  const a = typeof artist === 'string' ? artist.trim() : '';
  const v = typeof venue === 'string' ? venue.trim() : '';
  if (a && v) return `${a} at ${v}`;
  return null;
}

/** Stored/display title: explicit JamBase name, else "{artist} at {venue}". */
export function resolveClipEventTitle(input: {
  event_title?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
}): string | null {
  const stored = typeof input.event_title === 'string' ? input.event_title.trim() : '';
  if (stored) return stored;
  return artistAtVenueTitle(input.artist_name, input.venue_name);
}
