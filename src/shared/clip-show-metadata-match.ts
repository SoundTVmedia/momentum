import { displayNamesClose } from './artist-name-match';
import { AUTO_APPLY_MAX_DISTANCE_MILES } from './clip-resolve-show-match';
import {
  jamBaseEventArtistName,
  jamBaseEventVenueCoords,
  jamBaseEventVenueName,
  haversineMiles,
} from './jambase-events';
import { jamBaseEventMatchesCapture } from './jambase-event-day';

export const CLIP_SHOW_METADATA_MESSAGES = {
  missing_timestamp:
    "This video has no capture date in its metadata, so it can't be posted to this show.",
  date_mismatch: "This video wasn't recorded on the night of this show.",
  location_mismatch: "This video's location doesn't match the venue for this show.",
  artist_mismatch: "The artist on this clip doesn't match this show.",
  venue_mismatch: "The venue on this clip doesn't match this show.",
} as const;

export type ClipShowMetadataMismatchReason = keyof typeof CLIP_SHOW_METADATA_MESSAGES;

export type ClipShowMetadataMatch =
  | { ok: true }
  | { ok: false; reason: ClipShowMetadataMismatchReason; message: string };

const GPS_MATCH_MAX_MILES = AUTO_APPLY_MAX_DISTANCE_MILES + 0.5;

function eventPerformerNames(ev: Record<string, unknown>): string[] {
  const names: string[] = [];
  const headliner = jamBaseEventArtistName(ev);
  if (headliner) names.push(headliner);
  const performer = ev.performer;
  if (Array.isArray(performer)) {
    for (const p of performer) {
      if (p && typeof p === 'object') {
        const name = (p as Record<string, unknown>).name;
        if (typeof name === 'string' && name.trim()) names.push(name.trim());
      }
    }
  }
  return names;
}

export function eventHasMatchingPerformer(
  ev: Record<string, unknown>,
  artistName: string | null | undefined,
): boolean {
  const posted = (artistName ?? '').trim();
  if (!posted) return true;
  return eventPerformerNames(ev).some((name) => displayNamesClose(posted, name));
}

export function eventHasMatchingVenue(
  ev: Record<string, unknown>,
  venueName: string | null | undefined,
): boolean {
  const posted = (venueName ?? '').trim();
  if (!posted) return true;
  const eventVenue = jamBaseEventVenueName(ev);
  if (!eventVenue || eventVenue === 'Venue TBA') return true;
  return displayNamesClose(posted, eventVenue);
}

/**
 * Require a clip's capture metadata (and posted artist/venue) to match a specific show.
 * Missing GPS is allowed; present GPS must be near the venue when coords are known.
 */
export function clipMetadataMatchesShow(input: {
  event: Record<string, unknown>;
  recordedAtIso: string | null | undefined;
  latitude?: number | null;
  longitude?: number | null;
  artistName?: string | null;
  venueName?: string | null;
}): ClipShowMetadataMatch {
  const recordedAt = typeof input.recordedAtIso === 'string' ? input.recordedAtIso.trim() : '';
  if (!recordedAt) {
    return {
      ok: false,
      reason: 'missing_timestamp',
      message: CLIP_SHOW_METADATA_MESSAGES.missing_timestamp,
    };
  }

  const captureMs = Date.parse(recordedAt);
  if (!Number.isFinite(captureMs)) {
    return {
      ok: false,
      reason: 'missing_timestamp',
      message: CLIP_SHOW_METADATA_MESSAGES.missing_timestamp,
    };
  }

  const startDate = typeof input.event.startDate === 'string' ? input.event.startDate.trim() : '';
  const lat =
    input.latitude != null && Number.isFinite(input.latitude) ? input.latitude : undefined;
  const lon =
    input.longitude != null && Number.isFinite(input.longitude) ? input.longitude : undefined;

  if (startDate && !jamBaseEventMatchesCapture(input.event, captureMs, lat, lon)) {
    return {
      ok: false,
      reason: 'date_mismatch',
      message: CLIP_SHOW_METADATA_MESSAGES.date_mismatch,
    };
  }

  if (lat != null && lon != null) {
    const venue = jamBaseEventVenueCoords(input.event);
    if (venue && haversineMiles(lat, lon, venue.lat, venue.lon) > GPS_MATCH_MAX_MILES) {
      return {
        ok: false,
        reason: 'location_mismatch',
        message: CLIP_SHOW_METADATA_MESSAGES.location_mismatch,
      };
    }
  }

  if (!eventHasMatchingPerformer(input.event, input.artistName)) {
    return {
      ok: false,
      reason: 'artist_mismatch',
      message: CLIP_SHOW_METADATA_MESSAGES.artist_mismatch,
    };
  }

  if (!eventHasMatchingVenue(input.event, input.venueName)) {
    return {
      ok: false,
      reason: 'venue_mismatch',
      message: CLIP_SHOW_METADATA_MESSAGES.venue_mismatch,
    };
  }

  return { ok: true };
}
