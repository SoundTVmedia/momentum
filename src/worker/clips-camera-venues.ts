import type { Context } from 'hono';
import type { ClipShowCandidate } from '../shared/types';
import { clipCandidatesFromJamBaseEvents } from '../shared/jambase-events';
import {
  CAMERA_VENUE_PICKER_COUNT,
  closestVenuesWithEventsOnCaptureDay,
  dedupeClipCandidatesByVenue,
  resolveGoingMarkClipCandidate,
} from '../shared/clip-resolve-show-match';
import { fetchCameraVenueJamBaseEvents } from './discover-jambase-enrich';
import { jamBaseQuotaFromEnv } from './jambase-client';

/**
 * POST /api/clips/camera-venues
 * Body: { latitude, longitude, at? (ISO) }
 * Returns the closest venues with JamBase event data for the capture date (max 3).
 */
export async function postCameraVenuesForClip(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  const atRaw = typeof body.at === 'string' ? body.at : '';
  const atMs = Date.parse(atRaw);
  const captureMs = Number.isFinite(atMs) ? atMs : Date.now();

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return c.json({ error: 'latitude and longitude are required' }, 400);
  }

  const key = c.env.JAMBASE_API_KEY;
  if (!key?.trim()) {
    return c.json({
      venues: [] as ClipShowCandidate[],
      notice: 'JamBase is not configured',
      meta: { rawEventCount: 0 },
    });
  }

  const jbQ = jamBaseQuotaFromEnv(c.env);
  const rawEvents = await fetchCameraVenueJamBaseEvents(
    key,
    jbQ,
    lat,
    lon,
    captureMs,
    50,
    50,
  );
  const mapped = clipCandidatesFromJamBaseEvents(rawEvents, lat, lon, captureMs, undefined, {
    loose: true,
  });
  const deduped = dedupeClipCandidatesByVenue(mapped);
  const venues = closestVenuesWithEventsOnCaptureDay(
    deduped,
    captureMs,
    lat,
    lon,
    CAMERA_VENUE_PICKER_COUNT,
  );

  c.header('Cache-Control', 'private, max-age=30');

  return c.json({
    venues,
    notice:
      venues.length === 0
        ? rawEvents.length === 0
          ? 'No JamBase events returned near this location.'
          : 'No JamBase shows tonight at nearby venues.'
        : null,
    meta: {
      rawEventCount: rawEvents.length,
      mappedCandidateCount: deduped.length,
      lat,
      lon,
      captureMs,
    },
  });
}

/** Client-side going mark fast path (same as resolve-show). */
export function goingMarkCameraVenue(
  goingMarks: Parameters<typeof resolveGoingMarkClipCandidate>[0],
  captureMs: number,
  lat: number,
  lon: number,
): ClipShowCandidate | null {
  return resolveGoingMarkClipCandidate(goingMarks, captureMs, lat, lon);
}
