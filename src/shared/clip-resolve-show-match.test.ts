import { describe, expect, it } from 'vitest';
import {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  canAutoApplyCandidate,
  resolveShowMatchFromCandidates,
} from './clip-resolve-show-match';
import type { ClipShowCandidate } from './types';
import type { UserShowMark } from './show-marks';

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

function goingMark(overrides: Partial<UserShowMark> = {}): UserShowMark {
  return {
    id: 1,
    status: 'going',
    jambase_event_id: 'jambase:ev-going',
    jambase_venue_id: 'jambase:123',
    jambase_artist_id: null,
    event_title: 'Show',
    artist_name: 'Artist',
    venue_name: 'Test Venue',
    venue_location: 'Austin, TX',
    start_date: '2026-06-09T20:00:00',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('canAutoApplyCandidate', () => {
  it('allows close venue-only rows', () => {
    expect(canAutoApplyCandidate(baseCandidate())).toBe(true);
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
});

describe('resolveShowMatchFromCandidates', () => {
  const captureMs = Date.parse('2026-06-09T22:00:00.000Z');

  it('auto-applies within one mile without a going mark', () => {
    const result = resolveShowMatchFromCandidates(
      [baseCandidate({ distance_miles: 0.4 })],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('single');
    expect(result.candidates[0]?.distance_miles).toBe(0.4);
  });

  it('auto-applies beyond one mile when a same-date going mark matches', () => {
    const far = baseCandidate({
      jambase_event_id: 'jambase:ev-going',
      distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 2,
    });
    const result = resolveShowMatchFromCandidates(
      [far],
      [goingMark()],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('single');
    expect(result.candidates[0]?.jambase_event_id).toBe('jambase:ev-going');
  });

  it('stays ambiguous beyond one mile without a matching going mark', () => {
    const far = baseCandidate({
      jambase_event_id: 'jambase:other',
      distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 2,
    });
    const result = resolveShowMatchFromCandidates(
      [far],
      [goingMark({ jambase_event_id: 'jambase:other-night', start_date: '2026-06-10T20:00:00' })],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('ambiguous');
    expect(result.candidates).toEqual([]);
  });
});
