import type { ClipShowCandidate } from './types';
import { jamBaseEventMatchesCapture } from './jambase-event-day';
import {
  pickGoingShowMarkForCapture,
  showMarkToClipCandidate,
  type UserShowMark,
} from './show-marks';

/** Auto-apply only when GPS ↔ venue is within this distance (high confidence). */
export const AUTO_APPLY_MAX_DISTANCE_MILES = 1;

/** Venues returned for manual picker when auto-apply is skipped. */
export const NEARBY_VENUE_PICKER_COUNT = 3;

export type ClipResolveMatch = 'none' | 'single' | 'ambiguous';

/** True when we may auto-fill venue (and show when present) without the nearby picker. */
export function canAutoApplyCandidate(candidate: ClipShowCandidate): boolean {
  const hasVenue =
    Boolean(candidate.jambase_venue_id?.trim()) || Boolean(candidate.venue_name?.trim());
  if (!hasVenue) return false;
  const dist = candidate.distance_miles;
  if (dist == null || !Number.isFinite(dist) || dist > AUTO_APPLY_MAX_DISTANCE_MILES) {
    return false;
  }
  return true;
}

export function clipCandidateMatchesGoingMark(
  candidate: ClipShowCandidate,
  mark: UserShowMark,
): boolean {
  const eventId = mark.jambase_event_id?.trim();
  const venueId = mark.jambase_venue_id?.trim();
  const candEventId = candidate.jambase_event_id?.trim();
  const candVenueId = candidate.jambase_venue_id?.trim();
  if (eventId && candEventId && eventId === candEventId) return true;
  if (venueId && candVenueId && venueId === candVenueId) return true;
  return false;
}

function findCandidateForGoingMark(
  candidates: ClipShowCandidate[],
  mark: UserShowMark,
): ClipShowCandidate | null {
  for (const candidate of candidates) {
    if (clipCandidateMatchesGoingMark(candidate, mark)) return candidate;
  }
  return null;
}

function candidateHasJamBaseEventData(candidate: ClipShowCandidate): boolean {
  return Boolean(candidate.jambase_event_id?.trim());
}

function candidateEventMatchesCapture(
  candidate: ClipShowCandidate,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  if (!candidateHasJamBaseEventData(candidate)) return false;
  const startDate = candidate.startDate?.trim();
  if (!startDate) return true;
  return jamBaseEventMatchesCapture(
    { startDate, location: { name: candidate.venue_name ?? '' } },
    captureMs,
    userLat,
    userLon,
  );
}

function closestCandidateWithJamBaseEventWithin1Mi(
  candidates: ClipShowCandidate[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): ClipShowCandidate | null {
  for (const candidate of candidates) {
    if (!canAutoApplyCandidate(candidate)) continue;
    if (candidateEventMatchesCapture(candidate, captureMs, userLat, userLon)) {
      return candidate;
    }
  }
  return null;
}

/** Going mark on the capture night → clip candidate (no distance limit). */
export function resolveGoingMarkClipCandidate(
  goingMarks: UserShowMark[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): ClipShowCandidate | null {
  const going = pickGoingShowMarkForCapture(goingMarks, captureMs, userLat, userLon);
  return going ? showMarkToClipCandidate(going) : null;
}

/** One row per venue (or per event if venue id missing), keeping the closest hit. */
export function resolveShowMatchFromCandidates(
  enrichedSorted: ClipShowCandidate[],
  goingMarks: UserShowMark[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): {
  match: ClipResolveMatch;
  candidates: ClipShowCandidate[];
  nearbyVenues: ClipShowCandidate[];
} {
  const nearbyVenues = enrichedSorted.slice(0, NEARBY_VENUE_PICKER_COUNT);
  if (enrichedSorted.length === 0) {
    const goingOnly = resolveGoingMarkClipCandidate(goingMarks, captureMs, userLat, userLon);
    if (goingOnly) {
      return { match: 'single', candidates: [goingOnly], nearbyVenues: [] };
    }
    return { match: 'none', candidates: [], nearbyVenues: [] };
  }

  const going = pickGoingShowMarkForCapture(goingMarks, captureMs, userLat, userLon);
  if (going) {
    const matched = findCandidateForGoingMark(enrichedSorted, going);
    if (matched) {
      return { match: 'single', candidates: [matched], nearbyVenues };
    }
    return {
      match: 'single',
      candidates: [showMarkToClipCandidate(going)],
      nearbyVenues,
    };
  }

  const closestWithEvent = closestCandidateWithJamBaseEventWithin1Mi(
    enrichedSorted,
    captureMs,
    userLat,
    userLon,
  );
  if (closestWithEvent) {
    return { match: 'single', candidates: [closestWithEvent], nearbyVenues };
  }

  if (nearbyVenues.length > 0) {
    return { match: 'ambiguous', candidates: [], nearbyVenues };
  }
  return { match: 'none', candidates: [], nearbyVenues: [] };
}

/** Client-side auto-apply when resolve-show returned ambiguous or going marks hydrated late. */
export function resolveShowAutoApplyCandidate(
  data: {
    match?: string;
    candidates?: ClipShowCandidate[];
    nearbyVenues?: ClipShowCandidate[];
  },
  goingMarks: UserShowMark[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): ClipShowCandidate | null {
  if (data.match === 'single' && data.candidates?.[0]) {
    return data.candidates[0];
  }

  const goingCandidate = resolveGoingMarkClipCandidate(
    goingMarks,
    captureMs,
    userLat,
    userLon,
  );
  if (goingCandidate) return goingCandidate;

  const pool = [...(data.candidates ?? []), ...(data.nearbyVenues ?? [])];
  return closestCandidateWithJamBaseEventWithin1Mi(pool, captureMs, userLat, userLon);
}
