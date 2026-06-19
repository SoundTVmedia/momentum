import { describe, expect, it } from 'vitest';
import {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  canAutoApplyCandidate,
} from '../shared/clip-resolve-show-match';
import type { ClipShowCandidate } from '../shared/types';

function baseCandidate(overrides: Partial<ClipShowCandidate> = {}): ClipShowCandidate {
  return {
    jambase_event_id: null,
    jambase_artist_id: null,
    jambase_venue_id: 'jambase:123',
    artist_name: null,
    venue_name: 'Test Venue',
    location: 'Austin, TX',
    event_title: null,
    startDate: '',
    distance_miles: 0.1,
    ...overrides,
  };
}

describe('canAutoApplyCandidate', () => {
  it('allows close venue-only rows (show/artist resolved separately from ACR)', () => {
    expect(canAutoApplyCandidate(baseCandidate())).toBe(true);
  });

  it('allows JamBase geo venues without computed distance when proximity is trusted', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          distance_miles: null,
          geo_proximity_trusted: true,
        }),
      ),
    ).toBe(true);
  });

  it('rejects when farther than auto-apply threshold', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 0.01,
        }),
      ),
    ).toBe(false);
  });

  it('allows close venue with a same-day show attached', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          startDate: '2026-06-09T20:00:00Z',
          distance_miles: 0.1,
        }),
      ),
    ).toBe(true);
  });

  it('allows auto-apply within two miles', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          distance_miles: 0.7,
        }),
      ),
    ).toBe(true);
  });

  it('rejects auto-apply beyond two miles', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 0.05,
        }),
      ),
    ).toBe(false);
  });

  it('rejects rows without a venue identity', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_venue_id: null,
          venue_name: null,
          distance_miles: 0.1,
        }),
      ),
    ).toBe(false);
  });
});
