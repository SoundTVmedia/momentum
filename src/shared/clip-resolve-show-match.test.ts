import { describe, expect, it } from 'vitest';
import {
  AUTO_APPLY_MAX_DISTANCE_MILES,
  CAMERA_VENUE_PICKER_COUNT,
  canAutoApplyCandidate,
  closestVenuesWithEventsOnCaptureDay,
  NEARBY_PICKER_MAX_DISTANCE_MILES,
  resolveCameraVenuePicker,
  resolveShowFromGoingMark,
  resolveShowMatchFromCandidates,
  resolveCameraGoingAutoFill,
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
    venue_timezone: null,
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

  it('allows JamBase geo venues without computed distance when proximity is trusted', () => {
    expect(
      canAutoApplyCandidate(
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          startDate: '2026-06-09T20:00:00',
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

  it('returns none with picker venues when event is beyond auto-apply but within picker radius', () => {
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
    expect(result.match).toBe('none');
    expect(result.candidates).toEqual([]);
    expect(result.nearbyVenues).toHaveLength(1);
  });

  it('returns none when event is beyond picker radius and no going mark on capture night', () => {
    const far = baseCandidate({
      jambase_event_id: 'jambase:ev-tonight',
      startDate: '2026-06-09T20:00:00',
      distance_miles: NEARBY_PICKER_MAX_DISTANCE_MILES + 1,
    });
    const result = resolveShowMatchFromCandidates(
      [far],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('none');
    expect(result.candidates).toEqual([]);
    expect(result.nearbyVenues).toEqual([]);
  });

  it('does not fall back to future going marks when venue cannot be matched', () => {
    const far = baseCandidate({
      jambase_event_id: 'jambase:ev-tonight',
      startDate: '2026-06-09T20:00:00',
      distance_miles: NEARBY_PICKER_MAX_DISTANCE_MILES + 1,
    });
    const futureGoing = goingMark({
      jambase_event_id: 'jambase:future-going',
      start_date: '2099-12-01T20:00:00',
      updated_at: '2026-06-10T20:00:00',
    });
    const result = resolveShowMatchFromCandidates(
      [far],
      [futureGoing],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result.match).toBe('none');
    expect(result.candidates).toHaveLength(0);
  });

  it('matches same-day event when venue timezone is preserved on the candidate', () => {
    const captureMs = Date.parse('2026-06-10T03:30:00.000Z');
    const result = resolveShowMatchFromCandidates(
      [
        baseCandidate({
          jambase_event_id: 'jambase:ev',
          startDate: '2026-06-09T20:00:00',
          venue_timezone: 'America/New_York',
          distance_miles: 0.5,
        }),
      ],
      [],
      captureMs,
      undefined,
      undefined,
    );
    expect(result.match).toBe('single');
  });

  it('returns single from going mark without JamBase candidates', () => {
    const captureMs = Date.parse('2026-06-09T22:00:00.000Z');
    const result = resolveShowFromGoingMark(
      [goingMark()],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result?.match).toBe('single');
    expect(result?.candidates[0]?.jambase_event_id).toBe('jambase:ev-going');
  });
});

describe('resolveCameraGoingAutoFill', () => {
  it('prefers in-progress mark (I\'m there) over other going marks', () => {
    const captureMs = Date.parse('2026-06-21T00:00:00.000Z');
    const inProgress = goingMark({
      jambase_event_id: 'im-there',
      start_date: '2026-06-20T19:30:00',
      venue_location: 'Brooklyn, NY',
      updated_at: '2026-06-20T23:00:00',
    });
    const laterTonight = goingMark({
      jambase_event_id: 'later',
      start_date: '2026-06-20T21:00:00',
      updated_at: '2026-06-20T18:00:00',
    });
    const result = resolveCameraGoingAutoFill(
      [laterTonight, inProgress],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result?.matchSource).toBe('im_there');
    expect(result?.candidate.jambase_event_id).toBe('im-there');
  });

  it('uses same-day going mark when none are in progress', () => {
    const captureMs = Date.parse('2026-06-09T22:00:00.000Z');
    const result = resolveCameraGoingAutoFill(
      [goingMark()],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result?.matchSource).toBe('going');
  });

  it('does not auto-fill future going marks', () => {
    const captureMs = Date.parse('2026-06-09T22:00:00.000Z');
    const result = resolveCameraGoingAutoFill(
      [goingMark({ start_date: '2026-06-20T20:00:00' })],
      captureMs,
      40.73,
      -73.99,
    );
    expect(result).toBeNull();
  });
});

describe('resolveCameraVenuePicker', () => {
  const captureMs = Date.parse('2026-06-09T22:00:00.000Z');

  it('returns up to three closest venues with event data for tonight', () => {
    const resolution = resolveCameraVenuePicker(
      [
        baseCandidate({
          jambase_event_id: 'a',
          jambase_venue_id: 'v1',
          startDate: '2026-06-09T19:30:00',
          venue_timezone: 'America/New_York',
          distance_miles: 0.6,
        }),
        baseCandidate({
          jambase_event_id: 'b',
          jambase_venue_id: 'v2',
          venue_name: 'Venue Two',
          startDate: '2026-06-09T20:00:00',
          venue_timezone: 'America/New_York',
          distance_miles: 1.2,
        }),
        baseCandidate({
          jambase_event_id: 'c',
          jambase_venue_id: 'v3',
          venue_name: 'Venue Three',
          startDate: '2026-06-09T21:00:00',
          venue_timezone: 'America/New_York',
          distance_miles: 2.5,
        }),
        baseCandidate({
          jambase_event_id: 'd',
          jambase_venue_id: 'v4',
          venue_name: 'Venue Four',
          startDate: '2026-06-09T21:00:00',
          venue_timezone: 'America/New_York',
          distance_miles: 4,
        }),
      ],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(resolution.mode).toBe('picker');
    if (resolution.mode === 'picker') {
      expect(resolution.venues).toHaveLength(CAMERA_VENUE_PICKER_COUNT);
      expect(resolution.venues[0]?.distance_miles).toBe(0.6);
    }
  });

  it('returns picker with one venue when only one qualifies', () => {
    const resolution = resolveCameraVenuePicker(
      [
        baseCandidate({
          jambase_event_id: 'a',
          startDate: '2026-06-09T19:30:00',
          venue_timezone: 'America/New_York',
          distance_miles: 0.6,
        }),
      ],
      [],
      captureMs,
      40.73,
      -73.99,
    );
    expect(resolution.mode).toBe('picker');
    if (resolution.mode === 'picker') {
      expect(resolution.venues).toHaveLength(1);
    }
  });
});

describe('closestVenuesWithEventsOnCaptureDay', () => {
  it('includes in-progress show on the same venue-local calendar day', () => {
    const captureMs = Date.parse('2026-06-10T00:30:00.000Z'); // 8:30pm Eastern on June 9
    const venues = closestVenuesWithEventsOnCaptureDay(
      [
        baseCandidate({
          jambase_event_id: 'ev',
          startDate: '2026-06-09T19:30:00',
          venue_timezone: 'America/New_York',
          distance_miles: 0.6,
        }),
      ],
      captureMs,
      40.73,
      -73.99,
    );
    expect(venues).toHaveLength(1);
  });

  it('excludes yesterday show on a different calendar day', () => {
    const captureMs = Date.parse('2026-06-20T18:00:00.000Z'); // 2pm Eastern on June 20
    const venues = closestVenuesWithEventsOnCaptureDay(
      [
        baseCandidate({
          jambase_event_id: 'ev-yesterday',
          startDate: '2026-06-19T19:30:00',
          venue_timezone: 'America/New_York',
          distance_miles: 0.6,
        }),
        baseCandidate({
          jambase_event_id: 'ev-today',
          jambase_venue_id: 'venue-2',
          startDate: '2026-06-20T20:00:00',
          venue_timezone: 'America/New_York',
          distance_miles: 1.2,
        }),
      ],
      captureMs,
      40.73,
      -73.99,
    );
    expect(venues).toHaveLength(1);
    expect(venues[0]?.jambase_event_id).toBe('ev-today');
  });

  it('includes in-progress show started earlier today within ten hours', () => {
    const captureMs = Date.parse('2026-06-21T02:00:00.000Z'); // 10pm Eastern June 20
    const venues = closestVenuesWithEventsOnCaptureDay(
      [
        baseCandidate({
          jambase_event_id: 'ev-tonight',
          startDate: '2026-06-20T19:30:00',
          venue_timezone: 'America/New_York',
          distance_miles: 0.6,
        }),
      ],
      captureMs,
      40.73,
      -73.99,
    );
    expect(venues).toHaveLength(1);
  });
});
