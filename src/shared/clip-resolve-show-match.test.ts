import { describe, expect, it } from 'vitest';
import {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  canAutoApplyCandidate,
  resolveCameraCaptureVenues,
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
  it('allows close venue-only rows within two miles', () => {
    expect(canAutoApplyCandidate(baseCandidate({ distance_miles: 1.8 }))).toBe(true);
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

  it('auto-applies within two miles with event data when no going mark', () => {
    const result = resolveShowMatchFromCandidates(
      [
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          startDate: '2026-06-09T20:00:00',
          distance_miles: 1.4,
        }),
      ],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('single');
    expect(result.candidates[0]?.distance_miles).toBe(1.4);
  });

  it('auto-applies beyond two miles when a same-date going mark matches', () => {
    const far = baseCandidate({
      jambase_event_id: 'jambase:ev-going',
      startDate: '2026-06-09T20:00:00',
      distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 3,
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

  it('returns picker when multiple venues with events are within two miles', () => {
    const result = resolveShowMatchFromCandidates(
      [
        baseCandidate({
          jambase_event_id: 'jambase:a',
          jambase_venue_id: 'jambase:v1',
          startDate: '2026-06-09T20:00:00',
          distance_miles: 0.4,
        }),
        baseCandidate({
          jambase_event_id: 'jambase:b',
          jambase_venue_id: 'jambase:v2',
          venue_name: 'Venue Two',
          startDate: '2026-06-09T21:00:00',
          distance_miles: 0.8,
        }),
      ],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('ambiguous');
    expect(result.nearbyVenues).toHaveLength(2);
  });

  it('auto-applies going mark data when no nearby JamBase row matches', () => {
    const result = resolveShowMatchFromCandidates(
      [],
      [goingMark()],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('single');
    expect(result.candidates[0]?.jambase_event_id).toBe('jambase:ev-going');
  });

  it('stays ambiguous when event is beyond two miles and no going mark on capture night', () => {
    const far = baseCandidate({
      jambase_event_id: 'jambase:ev-tonight',
      startDate: '2026-06-09T20:00:00',
      distance_miles: AUTO_APPLY_MAX_DISTANCE_MILES + 1,
    });
    const result = resolveShowMatchFromCandidates(
      [far],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('ambiguous');
    expect(result.candidates).toEqual([]);
  });
});

describe('resolveCameraCaptureVenues', () => {
  const captureMs = Date.parse('2026-06-09T22:00:00.000Z');

  it('returns picker mode for multiple qualifying venues', () => {
    const resolution = resolveCameraCaptureVenues(
      {
        match: 'ambiguous',
        nearbyVenues: [
          baseCandidate({
            jambase_event_id: 'a',
            jambase_venue_id: 'v1',
            startDate: '2026-06-09T20:00:00',
            distance_miles: 0.5,
          }),
          baseCandidate({
            jambase_event_id: 'b',
            jambase_venue_id: 'v2',
            venue_name: 'Two',
            startDate: '2026-06-09T20:00:00',
            distance_miles: 1.1,
          }),
        ],
      },
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(resolution.mode).toBe('picker');
    if (resolution.mode === 'picker') {
      expect(resolution.venues).toHaveLength(2);
    }
  });
});
