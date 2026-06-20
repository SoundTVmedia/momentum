import type { ClipShowCandidate } from '../shared/types';
import { hasManualShowArtistVenue } from '../shared/content-feed';
import { isPrePostContentFeed } from '../shared/pre-post-clip';
import { computeShowId } from '../shared/show-id';
import { resolveClipEventTitle } from '../shared/event-title';
import {
  canAutoApplyCandidate,
  closestVenuesWithEventsOnCaptureDay,
  dedupeClipCandidatesByVenue,
  resolveCameraGoingAutoFill,
  resolveShowFromGoingMark,
  resolveShowMatchFromCandidates,
} from '../shared/clip-resolve-show-match';
import { clipCandidatesFromJamBaseEvents } from '../shared/jambase-events';
import { JAMBASE_CAMERA_EVENT_MAX_HOURS_AFTER_START } from '../shared/jambase-event-day';
import { fetchCameraVenueJamBaseEvents } from './discover-jambase-enrich';
import { jamBaseQuotaFromEnv } from './jambase-client';
import { haversineMiles } from './search-geo';
import { loadGoingShowMarksForUser } from './user-show-marks-endpoints';

/** Same slack as sticky client session after a post at the venue. */
const RECENT_CLIP_MAX_DISTANCE_MILES = 2.5;

export type ClipShowTagEnrichmentSource = 'going' | 'recent_clip' | 'jambase';

export type ClipShowTagEnrichment = {
  artist_name: string | null;
  venue_name: string | null;
  location: string | null;
  jambase_event_id: string | null;
  jambase_artist_id: string | null;
  jambase_venue_id: string | null;
  event_title: string | null;
  show_id: string | null;
  source: ClipShowTagEnrichmentSource;
};

export function enrichmentFromCandidate(
  candidate: ClipShowCandidate,
  source: ClipShowTagEnrichmentSource,
  captureMs: number,
): ClipShowTagEnrichment {
  const artist = candidate.artist_name?.trim() || null;
  const venue = candidate.venue_name?.trim() || null;
  const location = candidate.location?.trim() || null;
  const eventTitle =
    resolveClipEventTitle({
      event_title: candidate.event_title,
      artist_name: candidate.artist_name,
      venue_name: candidate.venue_name,
    }) ?? null;

  return {
    artist_name: artist,
    venue_name: venue,
    location,
    jambase_event_id: candidate.jambase_event_id?.trim() || null,
    jambase_artist_id: candidate.jambase_artist_id?.trim() || null,
    jambase_venue_id: candidate.jambase_venue_id?.trim() || null,
    event_title: eventTitle,
    show_id: computeShowId({
      jambase_event_id: candidate.jambase_event_id,
      artist_name: artist,
      venue_name: venue,
      timestamp: new Date(captureMs).toISOString(),
    }),
    source,
  };
}

function clipRowToCandidate(row: Record<string, unknown>): ClipShowCandidate {
  return {
    jambase_event_id:
      typeof row.jambase_event_id === 'string' ? row.jambase_event_id : null,
    jambase_artist_id:
      typeof row.jambase_artist_id === 'string' ? row.jambase_artist_id : null,
    jambase_venue_id:
      typeof row.jambase_venue_id === 'string' ? row.jambase_venue_id : null,
    artist_name: typeof row.artist_name === 'string' ? row.artist_name : null,
    venue_name: typeof row.venue_name === 'string' ? row.venue_name : null,
    location: typeof row.location === 'string' ? row.location : null,
    event_title: typeof row.event_title === 'string' ? row.event_title : null,
    startDate: typeof row.timestamp === 'string' ? row.timestamp : '',
    distance_miles: 0,
  };
}

/** User's most recent published clip near this GPS fix (same show night). */
export async function loadRecentClipShowCandidate(
  db: D1Database,
  mochaUserId: string,
  lat: number,
  lon: number,
  captureMs: number,
): Promise<ClipShowCandidate | null> {
  const lookbackMs = captureMs - JAMBASE_CAMERA_EVENT_MAX_HOURS_AFTER_START * 60 * 60 * 1000;
  const rows = await db
    .prepare(
      `SELECT artist_name, venue_name, location, jambase_event_id, jambase_artist_id,
              jambase_venue_id, event_title, timestamp, geolocation_latitude, geolocation_longitude
       FROM clips
       WHERE mocha_user_id = ?
         AND is_draft = 0
         AND status = 'published'
         AND (content_feed = 'main' OR content_feed IS NULL)
         AND venue_name IS NOT NULL AND trim(venue_name) != ''
         AND geolocation_latitude IS NOT NULL
         AND geolocation_longitude IS NOT NULL
         AND datetime(timestamp) >= datetime(?)
       ORDER BY timestamp DESC
       LIMIT 30`,
    )
    .bind(mochaUserId, new Date(lookbackMs).toISOString())
    .all();

  for (const raw of rows.results ?? []) {
    const row = raw as Record<string, unknown>;
    const rLat = Number(row.geolocation_latitude);
    const rLon = Number(row.geolocation_longitude);
    if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) continue;
    if (haversineMiles(lat, lon, rLat, rLon) > RECENT_CLIP_MAX_DISTANCE_MILES) continue;

    const ts = typeof row.timestamp === 'string' ? row.timestamp : '';
    const clipMs = Date.parse(ts);
    if (Number.isFinite(clipMs) && captureMs - clipMs > JAMBASE_CAMERA_EVENT_MAX_HOURS_AFTER_START * 60 * 60 * 1000) {
      continue;
    }

    return clipRowToCandidate(row);
  }

  return null;
}

async function resolveJamBaseShowCandidate(
  env: Env,
  lat: number,
  lon: number,
  captureMs: number,
  goingMarks: Awaited<ReturnType<typeof loadGoingShowMarksForUser>>,
): Promise<ClipShowCandidate | null> {
  const key = env.JAMBASE_API_KEY?.trim();
  if (!key) return null;

  const jbQ = jamBaseQuotaFromEnv(env);
  const { events: rawEvents } = await fetchCameraVenueJamBaseEvents(
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

  const { match, candidates } = resolveShowMatchFromCandidates(
    deduped,
    goingMarks,
    captureMs,
    lat,
    lon,
  );
  if (match === 'single' && candidates[0]) {
    return candidates[0];
  }

  const tonight = closestVenuesWithEventsOnCaptureDay(deduped, captureMs, lat, lon, 1);
  if (tonight.length === 1 && canAutoApplyCandidate(tonight[0]!)) {
    return tonight[0]!;
  }

  return null;
}

export type EnrichClipShowTagsInput = {
  lat: number;
  lon: number;
  captureMs: number;
  artistName?: string | null;
  venueName?: string | null;
  location?: string | null;
  contentFeed?: string | null;
};

/**
 * Infer show tags when the client posted without venue/artist (poor connectivity).
 * Priority: going / I'm there → recent clip at same GPS → unambiguous JamBase match.
 */
export async function enrichClipShowTagsFromMetadata(
  env: Env,
  mochaUserId: string,
  input: EnrichClipShowTagsInput,
): Promise<ClipShowTagEnrichment | null> {
  if (isPrePostContentFeed(input.contentFeed ?? 'main')) return null;
  if (hasManualShowArtistVenue(input.artistName, input.venueName)) return null;

  const { lat, lon, captureMs } = input;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const goingMarks = await loadGoingShowMarksForUser(env.DB, mochaUserId);

  const goingAuto = resolveCameraGoingAutoFill(goingMarks, captureMs, lat, lon);
  if (goingAuto?.candidate.venue_name?.trim() || goingAuto?.candidate.jambase_venue_id) {
    return enrichmentFromCandidate(goingAuto.candidate, 'going', captureMs);
  }

  const goingResolve = resolveShowFromGoingMark(goingMarks, captureMs, lat, lon);
  if (goingResolve?.candidates[0]) {
    return enrichmentFromCandidate(goingResolve.candidates[0], 'going', captureMs);
  }

  const recent = await loadRecentClipShowCandidate(env.DB, mochaUserId, lat, lon, captureMs);
  if (recent?.venue_name?.trim() || recent?.jambase_venue_id) {
    return enrichmentFromCandidate(recent, 'recent_clip', captureMs);
  }

  try {
    const jb = await resolveJamBaseShowCandidate(env, lat, lon, captureMs, goingMarks);
    if (jb?.venue_name?.trim() || jb?.jambase_venue_id) {
      return enrichmentFromCandidate(jb, 'jambase', captureMs);
    }
  } catch (err) {
    console.error('enrichClipShowTagsFromMetadata JamBase:', err);
  }

  return null;
}

export function mergeEnrichmentIntoClipFields<
  T extends {
    resolvedArtist: string | null;
    resolvedVenue: string | null;
    resolvedLocation: string | null;
    resolvedJambaseEventId: string | null;
    resolvedJambaseArtistId: string | null;
    resolvedJambaseVenueId: string | null;
    resolvedEventTitle: string | null;
    showId: string | null;
    resolvedTimestamp: string;
  },
>(fields: T, enrichment: ClipShowTagEnrichment): T {
  const artist = fields.resolvedArtist?.trim() || enrichment.artist_name;
  const venue = fields.resolvedVenue?.trim() || enrichment.venue_name;
  const location = fields.resolvedLocation?.trim() || enrichment.location;
  const eventTitle = fields.resolvedEventTitle?.trim() || enrichment.event_title;

  return {
    ...fields,
    resolvedArtist: artist,
    resolvedVenue: venue,
    resolvedLocation: location,
    resolvedJambaseEventId:
      fields.resolvedJambaseEventId?.trim() || enrichment.jambase_event_id,
    resolvedJambaseArtistId:
      fields.resolvedJambaseArtistId?.trim() || enrichment.jambase_artist_id,
    resolvedJambaseVenueId:
      fields.resolvedJambaseVenueId?.trim() || enrichment.jambase_venue_id,
    resolvedEventTitle: eventTitle,
    showId:
      fields.showId?.trim() ||
      enrichment.show_id ||
      computeShowId({
        jambase_event_id: fields.resolvedJambaseEventId ?? enrichment.jambase_event_id,
        artist_name: artist,
        venue_name: venue,
        timestamp: fields.resolvedTimestamp,
      }),
  };
}

export async function enrichDraftClipRowIfNeeded(
  env: Env,
  clipId: number,
  mochaUserId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT artist_name, venue_name, location, timestamp, content_feed,
            geolocation_latitude, geolocation_longitude,
            jambase_event_id, jambase_artist_id, jambase_venue_id, event_title, show_id
     FROM clips WHERE id = ? AND mocha_user_id = ?`,
  )
    .bind(clipId, mochaUserId)
    .first<Record<string, unknown>>();

  if (!row) return false;
  if (hasManualShowArtistVenue(String(row.artist_name ?? ''), String(row.venue_name ?? ''))) {
    return false;
  }

  const lat = Number(row.geolocation_latitude);
  const lon = Number(row.geolocation_longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  const ts = typeof row.timestamp === 'string' ? row.timestamp : '';
  const captureMs = Number.isFinite(Date.parse(ts)) ? Date.parse(ts) : Date.now();

  const enrichment = await enrichClipShowTagsFromMetadata(env, mochaUserId, {
    lat,
    lon,
    captureMs,
    artistName: typeof row.artist_name === 'string' ? row.artist_name : null,
    venueName: typeof row.venue_name === 'string' ? row.venue_name : null,
    location: typeof row.location === 'string' ? row.location : null,
    contentFeed: typeof row.content_feed === 'string' ? row.content_feed : null,
  });

  if (!enrichment?.venue_name?.trim() && !enrichment?.jambase_venue_id) return false;

  const artist = String(row.artist_name ?? '').trim() || enrichment.artist_name;
  const venue = String(row.venue_name ?? '').trim() || enrichment.venue_name;
  const location = String(row.location ?? '').trim() || enrichment.location;
  const eventTitle = String(row.event_title ?? '').trim() || enrichment.event_title;
  const showId =
    String(row.show_id ?? '').trim() ||
    enrichment.show_id ||
    computeShowId({
      jambase_event_id:
        (typeof row.jambase_event_id === 'string' ? row.jambase_event_id : null) ??
        enrichment.jambase_event_id,
      artist_name: artist,
      venue_name: venue,
      timestamp: ts || new Date(captureMs).toISOString(),
    });

  await env.DB.prepare(
    `UPDATE clips SET
       artist_name = COALESCE(NULLIF(trim(artist_name), ''), ?),
       venue_name = COALESCE(NULLIF(trim(venue_name), ''), ?),
       location = COALESCE(NULLIF(trim(location), ''), ?),
       jambase_event_id = COALESCE(NULLIF(trim(jambase_event_id), ''), ?),
       jambase_artist_id = COALESCE(NULLIF(trim(jambase_artist_id), ''), ?),
       jambase_venue_id = COALESCE(NULLIF(trim(jambase_venue_id), ''), ?),
       event_title = COALESCE(NULLIF(trim(event_title), ''), ?),
       show_id = COALESCE(NULLIF(trim(show_id), ''), ?),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(
      artist,
      venue,
      location,
      enrichment.jambase_event_id,
      enrichment.jambase_artist_id,
      enrichment.jambase_venue_id,
      eventTitle,
      showId,
      clipId,
    )
    .run();

  return true;
}
