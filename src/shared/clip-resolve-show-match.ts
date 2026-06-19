import type { ClipShowCandidate } from './types';
import { jamBaseEventMatchesCapture } from './jambase-event-day';
import {
  pickGoingShowMarkForCapture,
  showMarkToClipCandidate,
  type UserShowMark,
} from './show-marks';

/** Auto-apply when GPS ↔ venue is within this distance (non–going-mark path). */
export const AUTO_APPLY_MAX_DISTANCE_MILES = 2;

/** Venues returned for manual picker when multiple matches qualify. */
export const NEARBY_VENUE_PICKER_COUNT = 5;

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

function candidateDistanceSortKey(d: number | null | undefined): number {
  if (d == null || !Number.isFinite(d)) return Number.POSITIVE_INFINITY;
  return d;
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
  const tz = candidate.venue_timezone?.trim();
  return jamBaseEventMatchesCapture(
    {
      startDate,
      location: tz
        ? { name: candidate.venue_name ?? '', address: { 'x-timezone': tz } }
        : { name: candidate.venue_name ?? '' },
    },
    captureMs,
    userLat,
    userLon,
  );
}

/** Closest venues with today's JamBase event within the auto-apply radius. */
export function nearbyEventVenuesWithinAutoApplyRadius(
  candidates: ClipShowCandidate[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): ClipShowCandidate[] {
  const matched: ClipShowCandidate[] = [];
  for (const candidate of candidates) {
    if (!canAutoApplyCandidate(candidate)) continue;
    if (candidateEventMatchesCapture(candidate, captureMs, userLat, userLon)) {
      matched.push(candidate);
    }
  }
  matched.sort(
    (a, b) =>
      candidateDistanceSortKey(a.distance_miles) - candidateDistanceSortKey(b.distance_miles),
  );
  return matched.slice(0, NEARBY_VENUE_PICKER_COUNT);
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
  const going = pickGoingShowMarkForCapture(goingMarks, captureMs, userLat, userLon);
  if (going) {
    const matched = findCandidateForGoingMark(enrichedSorted, going);
    const candidate = matched ?? showMarkToClipCandidate(going);
    const nearbyVenues = enrichedSorted.slice(0, NEARBY_VENUE_PICKER_COUNT);
    return { match: 'single', candidates: [candidate], nearbyVenues };
  }

  const eventMatches = nearbyEventVenuesWithinAutoApplyRadius(
    enrichedSorted,
    captureMs,
    userLat,
    userLon,
  );

  if (eventMatches.length === 1) {
    return {
      match: 'single',
      candidates: [eventMatches[0]!],
      nearbyVenues: eventMatches,
    };
  }

  if (eventMatches.length > 1) {
    return { match: 'ambiguous', candidates: [], nearbyVenues: eventMatches };
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
  const matches = nearbyEventVenuesWithinAutoApplyRadius(pool, captureMs, userLat, userLon);
  return matches.length === 1 ? matches[0]! : null;
}

export type CameraCaptureVenueResolution =
  | { mode: 'none' }
  | { mode: 'single'; candidate: ClipShowCandidate }
  | { mode: 'picker'; venues: ClipShowCandidate[] };

/** Camera HUD: going mark, single auto-fill, or multi-venue picker. */
export function resolveCameraCaptureVenues(
  data: {
    match?: string;
    candidates?: ClipShowCandidate[];
    nearbyVenues?: ClipShowCandidate[];
  },
  goingMarks: UserShowMark[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): CameraCaptureVenueResolution {
  const goingCandidate = resolveGoingMarkClipCandidate(
    goingMarks,
    captureMs,
    userLat,
    userLon,
  );
  if (goingCandidate) {
    return { mode: 'single', candidate: goingCandidate };
  }

  if (data.match === 'single' && data.candidates?.[0]) {
    return { mode: 'single', candidate: data.candidates[0] };
  }

  const pool = [...(data.candidates ?? []), ...(data.nearbyVenues ?? [])];
  const matches = nearbyEventVenuesWithinAutoApplyRadius(pool, captureMs, userLat, userLon);
  if (matches.length === 1) {
    return { mode: 'single', candidate: matches[0]! };
  }
  if (matches.length > 1) {
    return { mode: 'picker', venues: matches };
  }

  return { mode: 'none' };
}
