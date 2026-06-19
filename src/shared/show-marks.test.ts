import { describe, expect, it } from 'vitest';
import {
  allowedShowMarkStatusForEvent,
  isPastJamBaseEvent,
  isUpcomingJamBaseEvent,
  isUpcomingShowMark,
  pastShowSummaryToJamBaseEvent,
  pickGoingShowMarkForCapture,
  showMarkToJamBaseEvent,
  upcomingGoingMarkEvents,
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

describe('pastShowSummaryToJamBaseEvent', () => {
  it('prefers jambase_event_id from clip data', () => {
    const ev = pastShowSummaryToJamBaseEvent({
      event_title: 'Phish at MSG',
      artist_name: 'Phish',
      show_date: '2025-04-20T01:00:00.000Z',
      venue_name: 'Madison Square Garden',
      jambase_event_id: 'jambase:999',
    });
    expect(ev?.identifier).toBe('jambase:999');
    expect(ev?.name).toBe('Phish at MSG');
    expect(allowedShowMarkStatusForEvent(ev!, new Date('2026-06-10T12:00:00'))).toBe(
      'attended',
    );
  });

  it('falls back to composite show id when jambase id is missing', () => {
    const ev = pastShowSummaryToJamBaseEvent({
      event_title: 'Taylor Swift at MSG',
      artist_name: 'Taylor Swift',
      show_date: '2025-04-20T01:00:00.000Z',
      venue_name: 'Madison Square Garden',
    });
    expect(ev?.identifier).toBe('taylor-swift-madison-square-garden-2025-04-20');
  });
});

describe('upcomingGoingMarkEvents', () => {
  const now = new Date('2026-06-10T12:00:00');

  it('pairs enriched events with marks by id, not filtered index', () => {
    const pastGoing = mark({
      jambase_event_id: 'jambase:past',
      start_date: '2026-06-01T20:00:00',
    });
    const futureGoing = mark({
      jambase_event_id: 'jambase:future',
      start_date: '2026-06-20T20:00:00',
    });
    const enriched = [
      { identifier: 'jambase:past', name: 'Past Night', image: 'https://example.com/past.jpg' },
      {
        identifier: 'jambase:future',
        name: 'Future Night',
        image: 'https://example.com/future.jpg',
      },
    ];

    const events = upcomingGoingMarkEvents([pastGoing, futureGoing], enriched);
    expect(events).toHaveLength(1);
    expect(events[0].identifier).toBe('jambase:future');
    expect(events[0].image).toBe('https://example.com/future.jpg');
    expect(isUpcomingShowMark(futureGoing, now.getTime())).toBe(true);
  });
});

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

describe('allowedShowMarkStatusForEvent', () => {
  const now = new Date('2026-06-10T12:00:00');

  it('allows Going on future events', () => {
    expect(
      allowedShowMarkStatusForEvent({ startDate: '2026-06-15T20:00:00' }, now),
    ).toBe('going');
  });

  it('allows Went on past events', () => {
    expect(
      allowedShowMarkStatusForEvent({ startDate: '2026-06-01T20:00:00' }, now),
    ).toBe('attended');
  });

  it('defaults missing startDate to Going', () => {
    expect(allowedShowMarkStatusForEvent({}, now)).toBe('going');
  });
});

describe('isUpcomingJamBaseEvent / isPastJamBaseEvent', () => {
  const now = new Date('2026-06-10T12:00:00');

  it('classifies today as upcoming', () => {
    const ev = { startDate: '2026-06-10T20:00:00' };
    expect(isUpcomingJamBaseEvent(ev, now)).toBe(true);
    expect(isPastJamBaseEvent(ev, now)).toBe(false);
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

  it('returns null when going marks are on a different night', () => {
    const picked = pickGoingShowMarkForCapture(
      [mark({ jambase_event_id: 'future', start_date: '2026-12-01T20:00:00' })],
      Date.parse('2026-06-09T22:00:00.000Z'),
      40.73,
      -73.99,
    );
    expect(picked).toBeNull();
  });
});
