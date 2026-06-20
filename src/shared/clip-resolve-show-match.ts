import type { ClipShowCandidate } from './types';
import {
  inferTimezoneFromCoords,
  jamBaseEventLocalYmd,
  jamBaseEventMatchesCapture,
  jamBaseEventOngoingAtCapture,
  jamBaseEventCameraCaptureDay,
  ymdInTimeZone,
} from './jambase-event-day';
import {
  pickGoingShowMarkForCapture,
  showMarkToClipCandidate,
  type UserShowMark,
} from './show-marks';

/** Auto-apply when GPS ↔ venue is within this distance (non–going-mark path). */
export const AUTO_APPLY_MAX_DISTANCE_MILES = 2;

/** Manual picker can surface same-day shows within this radius when auto-apply misses. */
export const NEARBY_PICKER_MAX_DISTANCE_MILES = 15;

/** Venues returned for manual picker when multiple matches qualify. */
export const NEARBY_VENUE_PICKER_COUNT = 5;

/** Camera capture screen: closest venues with tonight's JamBase event in the dropdown. */
export const CAMERA_VENUE_PICKER_COUNT = 3;

export type ClipResolveMatch = 'none' | 'single' | 'ambiguous';

/** True when we may auto-fill venue (and show when present) without the nearby picker. */
export function canAutoApplyCandidate(candidate: ClipShowCandidate): boolean {
  const hasVenue =
    Boolean(candidate.jambase_venue_id?.trim()) || Boolean(candidate.venue_name?.trim());
  if (!hasVenue) return false;
  const dist = candidate.distance_miles;
  if (dist == null || !Number.isFinite(dist)) {
    // JamBase geo `/venues` rows are already proximity-filtered even when coords are missing.
    return Boolean(candidate.geo_proximity_trusted);
  }
  if (dist > AUTO_APPLY_MAX_DISTANCE_MILES) return false;
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
  const ev = {
    startDate,
    location: tz
      ? { name: candidate.venue_name ?? '', address: { 'x-timezone': tz } }
      : { name: candidate.venue_name ?? '' },
  };
  if (jamBaseEventMatchesCapture(ev, captureMs, userLat, userLon)) return true;
  if (jamBaseEventOngoingAtCapture(ev, captureMs, userLat, userLon)) return true;
  const eventYmd = jamBaseEventLocalYmd(startDate);
  if (!eventYmd) return false;
  const captureTz =
    tz ||
    (userLat != null && userLon != null ? inferTimezoneFromCoords(userLat, userLon) : null) ||
    'UTC';
  return eventYmd === ymdInTimeZone(captureMs, captureTz);
}

/** Camera picker: venue-local calendar day only (excludes yesterday's in-progress shows). */
export function clipCandidateMatchesCameraCaptureDay(
  candidate: ClipShowCandidate,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  if (!candidateHasJamBaseEventData(candidate)) return false;
  const startDate = candidate.startDate?.trim();
  if (!startDate) return false;
  const tz = candidate.venue_timezone?.trim();
  const ev = {
    startDate,
    location: tz
      ? { name: candidate.venue_name ?? '', address: { 'x-timezone': tz } }
      : { name: candidate.venue_name ?? '' },
  };
  return jamBaseEventCameraCaptureDay(ev, captureMs, userLat, userLon);
}

function candidateEventOnCaptureCalendarDay(
  candidate: ClipShowCandidate,
  captureMs: number,
  userLat?: number,
  userLon?: number,
): boolean {
  return clipCandidateMatchesCameraCaptureDay(candidate, captureMs, userLat, userLon);
}

/** Closest venues with today's JamBase event within the auto-apply radius. */
export function nearbyEventVenuesWithinAutoApplyRadius(
  candidates: ClipShowCandidate[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): ClipShowCandidate[] {
  return sameDayEventVenuesWithinRadius(
    candidates,
    captureMs,
    AUTO_APPLY_MAX_DISTANCE_MILES,
    userLat,
    userLon,
  ).slice(0, NEARBY_VENUE_PICKER_COUNT);
}

/** Same-day show venues within `maxMiles` for manual picker (wider than auto-apply). */
export function sameDayEventVenuesWithinRadius(
  candidates: ClipShowCandidate[],
  captureMs: number,
  maxMiles: number,
  userLat?: number,
  userLon?: number,
): ClipShowCandidate[] {
  const matched: ClipShowCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidateWithinRadius(candidate, maxMiles)) continue;
    if (candidateEventMatchesCapture(candidate, captureMs, userLat, userLon)) {
      matched.push(candidate);
    }
  }
  matched.sort(
    (a, b) =>
      candidateDistanceSortKey(a.distance_miles) - candidateDistanceSortKey(b.distance_miles),
  );
  return matched;
}

/**
 * Closest venues with JamBase event data for the capture calendar day (venue-local).
 * Excludes yesterday's shows even if still within the in-progress window.
 */
export function closestVenuesWithEventsOnCaptureDay(
  candidates: ClipShowCandidate[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
  limit = CAMERA_VENUE_PICKER_COUNT,
): ClipShowCandidate[] {
  const matched: ClipShowCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidateEventOnCaptureCalendarDay(candidate, captureMs, userLat, userLon)) continue;
    matched.push(candidate);
  }
  matched.sort(
    (a, b) =>
      candidateDistanceSortKey(a.distance_miles) - candidateDistanceSortKey(b.distance_miles),
  );
  return dedupeClipCandidatesByVenue(matched).slice(0, limit);
}

function candidateWithinRadius(candidate: ClipShowCandidate, maxMiles: number): boolean {
  const dist = candidate.distance_miles;
  if (dist == null || !Number.isFinite(dist)) {
    return Boolean(candidate.geo_proximity_trusted);
  }
  return dist <= maxMiles;
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

/** Server fast-path: same-date going mark → single auto-fill (no JamBase required). */
export function resolveShowFromGoingMark(
  goingMarks: UserShowMark[],
  captureMs: number,
  userLat?: number,
  userLon?: number,
): {
  match: 'single';
  candidates: ClipShowCandidate[];
  nearbyVenues: ClipShowCandidate[];
} | null {
  const candidate = resolveGoingMarkClipCandidate(
    goingMarks,
    captureMs,
    userLat,
    userLon,
  );
  if (!candidate) return null;
  return { match: 'single', candidates: [candidate], nearbyVenues: [] };
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

  const pickerMatches = sameDayEventVenuesWithinRadius(
    enrichedSorted,
    captureMs,
    NEARBY_PICKER_MAX_DISTANCE_MILES,
    userLat,
    userLon,
  ).slice(0, NEARBY_VENUE_PICKER_COUNT);

  if (eventMatches.length === 1) {
    return {
      match: 'single',
      candidates: [eventMatches[0]!],
      nearbyVenues: pickerMatches.length > 0 ? pickerMatches : eventMatches,
    };
  }

  if (eventMatches.length > 1) {
    return { match: 'ambiguous', candidates: [], nearbyVenues: eventMatches };
  }

  if (pickerMatches.length > 0) {
    return { match: 'none', candidates: [], nearbyVenues: pickerMatches };
  }

  return { match: 'none', candidates: [], nearbyVenues: [] };
}

/** Flatten resolve-show JSON into deduped clip candidates. */
export function clipCandidatesFromResolveResponse(data: {
  candidates?: ClipShowCandidate[];
  nearbyVenues?: ClipShowCandidate[];
}): ClipShowCandidate[] {
  return dedupeClipCandidatesByVenue([
    ...(data.candidates ?? []),
    ...(data.nearbyVenues ?? []),
  ]);
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

/**
 * Camera HUD: going mark auto-fill, otherwise dropdown of the closest venues with
 * tonight's JamBase event (up to {@link CAMERA_VENUE_PICKER_COUNT}).
 */
export function resolveCameraVenuePicker(
  candidates: ClipShowCandidate[],
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

  const venues = closestVenuesWithEventsOnCaptureDay(
    candidates,
    captureMs,
    userLat,
    userLon,
    CAMERA_VENUE_PICKER_COUNT,
  );
  if (venues.length === 0) return { mode: 'none' };
  return { mode: 'picker', venues };
}

/** @deprecated Use {@link resolveCameraVenuePicker} for the camera capture screen. */
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

  const serverPick = dedupeClipCandidatesByVenue([
    ...(data.candidates ?? []),
    ...(data.nearbyVenues ?? []),
  ]);
  if (data.match === 'ambiguous' && serverPick.length > 0) {
    if (serverPick.length > 1) {
      return { mode: 'picker', venues: serverPick.slice(0, NEARBY_VENUE_PICKER_COUNT) };
    }
    return { mode: 'single', candidate: serverPick[0]! };
  }
  if (serverPick.length === 1) {
    return { mode: 'single', candidate: serverPick[0]! };
  }
  if (serverPick.length > 1) {
    return { mode: 'picker', venues: serverPick.slice(0, NEARBY_VENUE_PICKER_COUNT) };
  }

  const pool = serverPick;
  const matches = nearbyEventVenuesWithinAutoApplyRadius(pool, captureMs, userLat, userLon);
  if (matches.length === 1) {
    return { mode: 'single', candidate: matches[0]! };
  }
  const pickerMatches = sameDayEventVenuesWithinRadius(
    pool,
    captureMs,
    NEARBY_PICKER_MAX_DISTANCE_MILES,
    userLat,
    userLon,
  ).slice(0, NEARBY_VENUE_PICKER_COUNT);
  if (pickerMatches.length > 1) {
    return { mode: 'picker', venues: pickerMatches };
  }
  if (pickerMatches.length === 1) {
    return { mode: 'single', candidate: pickerMatches[0]! };
  }

  return { mode: 'none' };
}

function candidateVenueDedupeKey(row: ClipShowCandidate): string | null {
  const vid = row.jambase_venue_id?.trim();
  if (vid) return `v:${vid}`;
  const eid = row.jambase_event_id?.trim();
  if (eid) return `e:${eid}`;
  const name = row.venue_name?.trim();
  return name ? `n:${name.toLowerCase()}` : null;
}

/** One row per venue (or event), keeping the closest hit. */
export function dedupeClipCandidatesByVenue(candidates: ClipShowCandidate[]): ClipShowCandidate[] {
  const map = new Map<string, ClipShowCandidate>();
  for (const row of candidates) {
    const key = candidateVenueDedupeKey(row);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    if (
      candidateDistanceSortKey(row.distance_miles) <
      candidateDistanceSortKey(prev.distance_miles)
    ) {
      map.set(key, row);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      candidateDistanceSortKey(a.distance_miles) - candidateDistanceSortKey(b.distance_miles),
  );
}
