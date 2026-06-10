import { describe, expect, it } from 'vitest';
import {
  isUpcomingShowMark,
  pickGoingShowMarkForCapture,
  showMarkToJamBaseEvent,
  type UserShowMark,
} from './show-marks';

function mark(overrides: Partial<UserShowMark>): UserShowMark {
  return {
    id: 1,
    status: 'going',
    jambase_event_id: 'jambase:ev1',
    jambase_venue_id: 'jambase:vn1',
    jambase_artist_id: null,
    event_title: 'Test Show',
    artist_name: 'Artist',
    venue_name: 'Venue',
    venue_location: 'NYC',
    start_date: '2026-06-09T20:00:00',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('showMarkToJamBaseEvent', () => {
  it('builds a grid-compatible event object', () => {
    const ev = showMarkToJamBaseEvent(
      mark({ event_title: 'Night One', artist_name: 'Artist', venue_name: 'Venue' }),
    );
    expect(ev.identifier).toBe('jambase:ev1');
    expect(ev.name).toBe('Night One');
    expect(Array.isArray(ev.performer)).toBe(true);
  });
});

describe('isUpcomingShowMark', () => {
  it('includes future going marks', () => {
    const future = mark({ start_date: '2099-06-09T20:00:00' });
    expect(isUpcomingShowMark(future)).toBe(true);
  });

  it('excludes attended marks', () => {
    expect(isUpcomingShowMark(mark({ status: 'attended' }))).toBe(false);
  });
});

describe('pickGoingShowMarkForCapture', () => {
  it('prefers a going mark on the capture night', () => {
    const captureMs = Date.parse('2026-06-10T03:30:00.000Z');
    const picked = pickGoingShowMarkForCapture(
      [
        mark({ jambase_event_id: 'a', start_date: '2026-06-10T20:00:00' }),
        mark({ jambase_event_id: 'b', start_date: '2026-06-09T20:00:00' }),
      ],
      captureMs,
      40.73,
      -73.99,
    );
    expect(picked?.jambase_event_id).toBe('b');
  });

  it('ignores attended marks', () => {
    const picked = pickGoingShowMarkForCapture(
      [mark({ status: 'attended' })],
      Date.parse('2026-06-09T22:00:00.000Z'),
    );
    expect(picked).toBeNull();
  });
});
