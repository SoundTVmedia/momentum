import { describe, expect, it } from 'vitest';
import {
  enrichmentFromCandidate,
  mergeEnrichmentIntoClipFields,
} from './clips-enrich-upload-show';
import type { ClipShowCandidate } from '../shared/types';

describe('clips-enrich-upload-show', () => {
  const captureMs = Date.parse('2026-06-20T22:00:00.000Z');

  it('enrichmentFromCandidate maps clip candidate fields', () => {
    const candidate: ClipShowCandidate = {
      jambase_event_id: 'jambase:ev1',
      jambase_artist_id: 'jambase:ar1',
      jambase_venue_id: 'jambase:vn1',
      artist_name: 'Artist',
      venue_name: 'Venue',
      location: 'Brooklyn, NY',
      event_title: 'Show Night',
      startDate: '2026-06-20T20:00:00',
      distance_miles: 0.5,
    };
    const out = enrichmentFromCandidate(candidate, 'recent_clip', captureMs);
    expect(out.venue_name).toBe('Venue');
    expect(out.source).toBe('recent_clip');
    expect(out.show_id).toBeTruthy();
  });

  it('mergeEnrichmentIntoClipFields fills only empty resolved fields', () => {
    const merged = mergeEnrichmentIntoClipFields(
      {
        resolvedArtist: null,
        resolvedVenue: null,
        resolvedLocation: null,
        resolvedJambaseEventId: null,
        resolvedJambaseArtistId: null,
        resolvedJambaseVenueId: null,
        resolvedEventTitle: null,
        showId: null,
        resolvedTimestamp: new Date(captureMs).toISOString(),
      },
      {
        artist_name: 'Artist',
        venue_name: 'Venue',
        location: 'NYC',
        jambase_event_id: 'jambase:ev1',
        jambase_artist_id: 'jambase:ar1',
        jambase_venue_id: 'jambase:vn1',
        event_title: 'Artist at Venue',
        show_id: 'show-1',
        source: 'going',
      },
    );
    expect(merged.resolvedVenue).toBe('Venue');
    expect(merged.resolvedJambaseVenueId).toBe('jambase:vn1');
    expect(merged.showId).toBe('show-1');
  });
});
