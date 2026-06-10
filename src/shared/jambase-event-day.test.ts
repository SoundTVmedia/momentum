import { describe, expect, it } from 'vitest';
import { jamBaseEventOnCaptureDay, jamBaseEventLocalYmd } from './jambase-event-day';

describe('jamBaseEventLocalYmd', () => {
  it('reads the date prefix without timezone conversion', () => {
    expect(jamBaseEventLocalYmd('2026-06-09T20:00:00')).toBe('2026-06-09');
  });
});

describe('jamBaseEventOnCaptureDay', () => {
  const event = {
    startDate: '2026-06-09T20:00:00',
    location: {
      name: 'Brooklyn Steel',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('matches evening capture on the same NYC calendar day', () => {
    // June 9, 2026 11:30 PM Eastern
    const captureMs = Date.parse('2026-06-10T03:30:00.000Z');
    expect(jamBaseEventOnCaptureDay(event, captureMs)).toBe(true);
  });

  it('rejects UTC-misparse that treated the show as the prior UTC day', () => {
    const captureMs = Date.parse('2026-06-10T03:30:00.000Z');
    const eventYmd = jamBaseEventLocalYmd('2026-06-09T20:00:00');
    const utcCaptureDay = '2026-06-10';
    expect(eventYmd).not.toBe(utcCaptureDay);
    expect(jamBaseEventOnCaptureDay(event, captureMs)).toBe(true);
  });

  it('rejects a show on a different venue-local day', () => {
    const captureMs = Date.parse('2026-06-10T15:00:00.000Z'); // June 10 in NYC
    expect(jamBaseEventOnCaptureDay(event, captureMs)).toBe(false);
  });
});
