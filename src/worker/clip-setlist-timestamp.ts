import {
  clipTimestampFromSetlistOrder,
  eventStartIsoFromPayload,
} from '../shared/clip-setlist-order';
import { jamBaseEventSetlist } from '../shared/jambase-setlist';
import { loadStoredShowPage } from './stored-show-page';

async function storedShowSetlistContext(
  db: D1Database,
  input: {
    jambaseEventId: string | null | undefined;
    eventPayload?: Record<string, unknown> | null;
  },
): Promise<{
  event: Record<string, unknown> | null;
  setlist: ReturnType<typeof jamBaseEventSetlist>;
}> {
  const eventId = input.jambaseEventId?.trim() || '';
  const stored = eventId ? await loadStoredShowPage(db, eventId) : null;
  const event = stored?.event ?? input.eventPayload ?? null;
  const setlist = stored?.setlist?.length ? stored.setlist : jamBaseEventSetlist(event);
  return { event, setlist };
}

/**
 * Recorded-time stand-in for a past-show clip that has a song title but no
 * capture metadata. Uses the stored setlist when the show has one.
 */
export async function clipTimestampFromStoredShowSetlist(
  db: D1Database,
  input: {
    jambaseEventId: string | null | undefined;
    songTitle: string | null | undefined;
    eventPayload?: Record<string, unknown> | null;
  },
): Promise<string | null> {
  const { event, setlist } = await storedShowSetlistContext(db, input);
  return clipTimestampFromSetlistOrder({
    eventStartIso: eventStartIsoFromPayload(event),
    setlist,
    songTitle: input.songTitle,
  });
}

/**
 * Keep a real capture timestamp. Only synthesize a setlist slot when the clip
 * has no recorded time at all.
 */
export async function fillMissingClipTimestampFromSetlist(
  db: D1Database,
  input: {
    existingTimestamp: string | null | undefined;
    jambaseEventId: string | null | undefined;
    songTitle: string | null | undefined;
    eventPayload?: Record<string, unknown> | null;
  },
): Promise<string | null> {
  const existing =
    typeof input.existingTimestamp === 'string' ? input.existingTimestamp.trim() : '';
  if (existing) return existing;
  return clipTimestampFromStoredShowSetlist(db, input);
}
