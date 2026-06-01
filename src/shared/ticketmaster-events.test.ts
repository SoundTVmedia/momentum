import { describe, expect, it } from 'vitest';
import {
  isTicketmasterEventOnOrAfterToday,
  pickClosestUpcomingTicketmasterEvent,
  type TicketmasterEvent,
} from './ticketmaster-events';

function event(
  partial: Partial<TicketmasterEvent> & Pick<TicketmasterEvent, 'id' | 'name' | 'url'>,
): TicketmasterEvent {
  return {
    dates: { start: { localDate: '2099-06-01' } },
    _embedded: {
      venues: [
        {
          name: 'Arena',
          location: { latitude: '40.0', longitude: '-74.0' },
        },
      ],
    },
    ...partial,
  };
}

describe('pickClosestUpcomingTicketmasterEvent', () => {
  it('prefers the nearer venue for upcoming shows', () => {
    const near = event({
      id: '1',
      name: 'Near',
      url: 'https://t.example/near',
      _embedded: {
        venues: [{ name: 'A', location: { latitude: '40.01', longitude: '-74.01' } }],
      },
    });
    const far = event({
      id: '2',
      name: 'Far',
      url: 'https://t.example/far',
      _embedded: {
        venues: [{ name: 'B', location: { latitude: '42.0', longitude: '-71.0' } }],
      },
    });
    const pick = pickClosestUpcomingTicketmasterEvent([far, near], 40, -74);
    expect(pick?.id).toBe('1');
  });

  it('skips past events', () => {
    const past = event({
      id: 'past',
      name: 'Past',
      url: 'https://t.example/past',
      dates: { start: { localDate: '2000-01-01' } },
    });
    const future = event({
      id: 'future',
      name: 'Future',
      url: 'https://t.example/future',
      dates: { start: { localDate: '2099-12-31' } },
    });
    const pick = pickClosestUpcomingTicketmasterEvent([past, future], 40, -74);
    expect(pick?.id).toBe('future');
  });
});

describe('isTicketmasterEventOnOrAfterToday', () => {
  it('treats today as eligible', () => {
    const now = new Date('2026-06-01T15:00:00');
    const ev = event({
      id: 't',
      name: 'Today',
      url: 'https://t.example/t',
      dates: { start: { localDate: '2026-06-01', localTime: '20:00:00' } },
    });
    expect(isTicketmasterEventOnOrAfterToday(ev, now)).toBe(true);
  });
});
