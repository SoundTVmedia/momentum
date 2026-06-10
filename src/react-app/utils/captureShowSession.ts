import type { ClipShowCandidate } from '@/shared/types';

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const STORAGE_KEY = 'momentum.captureShowSession.v1';

/** How long a show-night session stays valid (aligns with in-show upload window). */
export const CAPTURE_SHOW_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** GPS slack after the user has posted at least once from this venue. */
const CONFIRMED_MAX_DISTANCE_MILES = 2.5;

/** GPS slack after resolve/pick but before first post. */
const MATCHED_MAX_DISTANCE_MILES = 1.5;

export type CaptureShowSession = {
  candidate: ClipShowCandidate;
  savedAtMs: number;
  anchorLat: number;
  anchorLon: number;
  /** Incremented each time the user posts a main-feed clip with this venue. */
  postsAtVenue: number;
};

export type CaptureShowNavState = Record<string, unknown>;

function hasVenueIdentity(c: ClipShowCandidate): boolean {
  return Boolean(c.jambase_venue_id?.trim() || c.venue_name?.trim());
}

function readRaw(): CaptureShowSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CaptureShowSession;
    if (!parsed?.candidate || !hasVenueIdentity(parsed.candidate)) return null;
    if (
      !Number.isFinite(parsed.savedAtMs) ||
      !Number.isFinite(parsed.anchorLat) ||
      !Number.isFinite(parsed.anchorLon)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(session: CaptureShowSession): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearCaptureShowSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clipShowCandidateToNavState(c: ClipShowCandidate): CaptureShowNavState {
  const out: CaptureShowNavState = {
    artist_name: c.artist_name ?? '',
    venue_name: c.venue_name ?? '',
    location: c.location ?? '',
  };
  if (c.jambase_event_id) out.jambase_event_id = c.jambase_event_id;
  if (c.jambase_artist_id) out.jambase_artist_id = c.jambase_artist_id;
  if (c.jambase_venue_id) out.jambase_venue_id = c.jambase_venue_id;
  if (c.event_title) out.event_title = c.event_title;
  return out;
}

export function saveCaptureShowSession(
  candidate: ClipShowCandidate,
  anchorLat: number,
  anchorLon: number,
  opts?: { incrementPost?: boolean },
): void {
  if (!hasVenueIdentity(candidate)) return;
  if (!Number.isFinite(anchorLat) || !Number.isFinite(anchorLon)) return;

  const prev = readRaw();
  const sameVenue =
    prev &&
    ((candidate.jambase_venue_id &&
      prev.candidate.jambase_venue_id === candidate.jambase_venue_id) ||
      (candidate.venue_name &&
        prev.candidate.venue_name?.trim().toLowerCase() ===
          candidate.venue_name.trim().toLowerCase()));

  const postsAtVenue = opts?.incrementPost
    ? (sameVenue ? (prev?.postsAtVenue ?? 0) : 0) + 1
    : sameVenue
      ? (prev?.postsAtVenue ?? 0)
      : 0;

  writeRaw({
    candidate,
    savedAtMs: Date.now(),
    anchorLat,
    anchorLon,
    postsAtVenue,
  });
}

export function markCaptureShowSessionPosted(
  candidate: ClipShowCandidate,
  anchorLat: number,
  anchorLon: number,
): void {
  saveCaptureShowSession(candidate, anchorLat, anchorLon, { incrementPost: true });
}

export type LoadCaptureShowSessionOpts = {
  lat?: number | null;
  lon?: number | null;
  /** Extend TTL while clips are still uploading in the background. */
  uploadsInFlight?: boolean;
};

export function loadCaptureShowSession(
  opts?: LoadCaptureShowSessionOpts,
): CaptureShowSession | null {
  const session = readRaw();
  if (!session) return null;

  const ttl = opts?.uploadsInFlight
    ? CAPTURE_SHOW_SESSION_TTL_MS + 2 * 60 * 60 * 1000
    : CAPTURE_SHOW_SESSION_TTL_MS;
  if (Date.now() - session.savedAtMs > ttl) {
    clearCaptureShowSession();
    return null;
  }

  const lat = opts?.lat;
  const lon = opts?.lon;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    const dist = haversineMiles(session.anchorLat, session.anchorLon, lat, lon);
    const maxMi =
      session.postsAtVenue >= 1 ? CONFIRMED_MAX_DISTANCE_MILES : MATCHED_MAX_DISTANCE_MILES;
    if (dist > maxMi) return null;
  }

  return session;
}

export function captureShowCandidateFromPostedClip(input: {
  artist_name: string;
  venue_name: string;
  location: string;
  jambaseLink: {
    event: string | null;
    artist: string | null;
    venue: string | null;
    eventTitle?: string | null;
  } | null;
}): ClipShowCandidate | null {
  const venueName = input.venue_name.trim();
  if (!venueName && !input.jambaseLink?.venue?.trim()) return null;

  return {
    jambase_event_id: input.jambaseLink?.event ?? null,
    jambase_artist_id: input.jambaseLink?.artist ?? null,
    jambase_venue_id: input.jambaseLink?.venue ?? null,
    artist_name: input.artist_name.trim() || null,
    venue_name: venueName || null,
    location: input.location.trim() || null,
    event_title: input.jambaseLink?.eventTitle ?? null,
    startDate: '',
    distance_miles: 0,
  };
}
