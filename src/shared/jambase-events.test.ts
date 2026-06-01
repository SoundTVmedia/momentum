import { describe, expect, it } from 'vitest';
import { isJamBaseEventOnOrAfterToday, pickClosestUpcomingJamBaseShow } from './jambase-events';

describe('pickClosestUpcomingJamBaseShow', () => {
  it('prefers the nearer venue', () => {
    const near = {
      identifier: '1',
      startDate: '2099-06-01T20:00:00Z',
      url: 'https://t.example/near',
      location: { geo: { latitude: 40.01, longitude: -74.01 } },
    };
    const far = {
      identifier: '2',
      startDate: '2099-06-02T20:00:00Z',
      url: 'https://t.example/far',
      location: { geo: { latitude: 42, longitude: -71 } },
    };
    const pick = pickClosestUpcomingJamBaseShow([far, near], 40, -74);
    expect(pick?.event.identifier).toBe('1');
  });

  it('returns null when no ticket URL', () => {
    const pick = pickClosestUpcomingJamBaseShow(
      [{ identifier: 'x', startDate: '2099-01-01T12:00:00Z' }],
      40,
      -74,
    );
    expect(pick).toBeNull();
  });
});

describe('isJamBaseEventOnOrAfterToday', () => {
  it('excludes past dates', () => {
    expect(
      isJamBaseEventOnOrAfterToday(
        { startDate: '2000-01-01T12:00:00Z' },
        new Date('2026-06-01'),
      ),
    ).toBe(false);
  });
});
