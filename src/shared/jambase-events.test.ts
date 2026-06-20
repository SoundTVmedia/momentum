import { describe, expect, it } from 'vitest';
import {
  isJamBaseEventOnOrAfterToday,
  jamBaseEventCardImageUrl,
  jamBaseEventImageUrl,
  pickClosestUpcomingJamBaseShow,
} from './jambase-events';

describe('jamBaseEventImageUrl', () => {
  it('prefers event image over performer image', () => {
    const url = jamBaseEventImageUrl({
      image: 'https://example.com/event.jpg',
      performer: [{ name: 'Artist', image: 'https://example.com/artist.jpg', 'x-isHeadliner': true }],
    });
    expect(url).toBe('https://example.com/event.jpg');
  });

  it('falls back to headliner image', () => {
    const url = jamBaseEventImageUrl({
      performer: [{ name: 'Artist', image: 'https://example.com/artist.jpg', 'x-isHeadliner': true }],
    });
    expect(url).toBe('https://example.com/artist.jpg');
  });

  it('uses stock fallback in card helper', () => {
    expect(jamBaseEventCardImageUrl({})).toContain('unsplash.com');
  });
});

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

  it('includes in-progress show within four hours of start', () => {
    expect(
      isJamBaseEventOnOrAfterToday(
        {
          startDate: '2026-06-10T19:30:00',
          location: { address: { 'x-timezone': 'America/New_York' } },
        },
        new Date('2026-06-11T01:00:00.000Z'),
      ),
    ).toBe(true);
  });
});
