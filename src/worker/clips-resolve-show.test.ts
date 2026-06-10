import { describe, expect, it } from 'vitest';
import {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  canAutoApplyCandidate,
} from './clips-resolve-show';
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
  it('rejects venue-only rows without a JamBase show', () => {
    expect(canAutoApplyCandidate(baseCandidate())).toBe(false);
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

  it('allows auto-apply within one mile', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          distance_miles: 0.7,
        }),
      ),
    ).toBe(true);
  });

  it('rejects auto-apply beyond one mile', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 0.05,
        }),
      ),
    ).toBe(false);
  });
});
