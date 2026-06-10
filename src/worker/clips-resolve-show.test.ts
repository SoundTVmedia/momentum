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
  const captureDay = '2026-06-09';

  it('rejects venue-only rows without a JamBase show', () => {
    expect(canAutoApplyCandidate(baseCandidate(), captureDay)).toBe(false);
  });

  it('rejects when farther than auto-apply threshold', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({ distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 0.01 }),
        captureDay,
      ),
    ).toBe(false);
  });

  it('rejects same-day event on wrong calendar day', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          startDate: '2026-06-10T01:00:00Z',
        }),
        captureDay,
      ),
    ).toBe(false);
  });

  it('allows same-day event on capture day', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          startDate: '2026-06-09T20:00:00Z',
        }),
        captureDay,
      ),
    ).toBe(true);
  });
});
