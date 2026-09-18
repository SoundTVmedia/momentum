import {
  clipRecordedAtOnShowNightMs,
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
 * Keep a timestamp only when it is the night of this show. A library file dated
 * today is replaced with the setlist slot when the clip has a matching song.
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
  const { event, setlist } = await storedShowSetlistContext(db, input);
  if (existing && clipRecordedAtOnShowNightMs({ timestamp: existing }, event) != null) {
    return existing;
  }
  const fromSetlist = clipTimestampFromSetlistOrder({
    eventStartIso: eventStartIsoFromPayload(event),
    setlist,
    songTitle: input.songTitle,
  });
  if (fromSetlist) return fromSetlist;
  return existing || null;
}
