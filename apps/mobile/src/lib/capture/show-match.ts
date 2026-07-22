import { apiJson } from '@/src/lib/api/client';
import type { ClipShowCandidate } from '@shared/types';
import { resolveClipEventTitle } from '@shared/event-title';
import {
  resolveCameraGoingAutoFill,
} from '@shared/clip-resolve-show-match';
import type { UserShowMark } from '@shared/show-marks';

export type CaptureShowPreview = {
  status: 'idle' | 'loading' | 'ready' | 'picker' | 'none' | 'error';
  eventTitle: string | null;
  venueName: string | null;
  artistName: string | null;
  locationLine: string | null;
  notice: string | null;
};

export function previewFromCandidate(
  cand: ClipShowCandidate,
  status: CaptureShowPreview['status'] = 'ready',
): CaptureShowPreview {
  return {
    status,
    eventTitle: resolveClipEventTitle({
      event_title: cand.event_title,
      artist_name: cand.artist_name,
      venue_name: cand.venue_name,
    }),
    venueName: cand.venue_name?.trim() ?? null,
    artistName: cand.artist_name?.trim() ?? null,
    locationLine: cand.location?.trim() ?? null,
    notice: null,
  };
}

export async function fetchGoingMarksForCapture(): Promise<UserShowMark[]> {
  try {
    const data = await apiJson<{ marks?: UserShowMark[] }>(
      '/api/users/me/show-marks?status=going&enrich=jambase',
    );
    return Array.isArray(data.marks) ? data.marks : [];
  } catch {
    return [];
  }
}

export function goingAutoFillCandidate(
  marks: UserShowMark[],
  lat: number,
  lon: number,
): ClipShowCandidate | null {
  const auto = resolveCameraGoingAutoFill(marks, Date.now(), lat, lon);
  return auto?.candidate ?? null;
}

export async function fetchCameraVenues(input: {
  latitude: number;
  longitude: number;
  at?: string;
}): Promise<{
  venues: ClipShowCandidate[];
  notice: string | null;
}> {
  const data = await apiJson<{
    venues?: ClipShowCandidate[];
    notice?: string | null;
  }>('/api/clips/camera-venues', {
    method: 'POST',
    body: JSON.stringify({
      latitude: input.latitude,
      longitude: input.longitude,
      at: input.at ?? new Date().toISOString(),
    }),
  });
  return {
    venues: Array.isArray(data.venues) ? data.venues : [],
    notice: typeof data.notice === 'string' ? data.notice : null,
  };
}

export function venueOptionKey(venue: ClipShowCandidate): string {
  return venue.jambase_venue_id ?? venue.venue_name ?? 'venue';
}

export function formFieldsFromCandidate(cand: ClipShowCandidate | null | undefined): {
  artist_name: string;
  venue_name: string;
  location: string;
} {
  if (!cand) {
    return { artist_name: '', venue_name: '', location: '' };
  }
  return {
    artist_name: cand.artist_name?.trim() ?? '',
    venue_name: cand.venue_name?.trim() ?? '',
    location: cand.location?.trim() ?? '',
  };
}
