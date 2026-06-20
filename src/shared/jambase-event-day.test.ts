import { describe, expect, it } from 'vitest';
import {
  inferTimezoneFromCoords,
  jamBaseEventLocalYmd,
  jamBaseEventMatchesCapture,
  jamBaseEventOnCaptureDay,
  jamBaseEventStartMs,
} from './jambase-event-day';

describe('jamBaseEventLocalYmd', () => {
  it('reads the date prefix without timezone conversion', () => {
    expect(jamBaseEventLocalYmd('2026-06-09T20:00:00')).toBe('2026-06-09');
  });
});

describe('inferTimezoneFromCoords', () => {
  it('infers Eastern for NYC coordinates', () => {
    expect(inferTimezoneFromCoords(40.73, -73.99)).toBe('America/New_York');
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

describe('jamBaseEventStartMs', () => {
  it('interprets startDate as venue-local wall time, not UTC', () => {
    const event = {
      startDate: '2026-06-09T20:00:00',
      location: {
        name: 'Brooklyn Steel',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    // 8pm Eastern on June 9, 2026 (EDT = UTC-4)
    expect(jamBaseEventStartMs(event)).toBe(Date.parse('2026-06-10T00:00:00.000Z'));
  });
});

describe('jamBaseEventMatchesCapture without x-timezone', () => {
  const eventNoTz = {
    startDate: '2026-06-09T20:00:00',
    location: { name: 'Brooklyn Steel' },
  };

  it('uses GPS-inferred US timezone when x-timezone is missing', () => {
    const captureMs = Date.parse('2026-06-10T03:30:00.000Z');
    expect(jamBaseEventMatchesCapture(eventNoTz, captureMs, 40.73, -73.99)).toBe(true);
  });

  it('matches after-midnight capture for a late show', () => {
    const captureMs = Date.parse('2026-06-10T05:00:00.000Z'); // 1am Eastern
    expect(jamBaseEventMatchesCapture(eventNoTz, captureMs, 40.73, -73.99)).toBe(true);
  });

  it('matches capture several hours after start while the show is ongoing', () => {
    const event = {
      startDate: '2026-06-09T20:00:00',
      location: {
        name: 'Brooklyn Steel',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    // 4:30am Eastern on June 10 (~8.5h after an 8pm start)
    const captureMs = Date.parse('2026-06-10T08:30:00.000Z');
    expect(jamBaseEventMatchesCapture(event, captureMs)).toBe(true);
  });

  it('matches in-progress show that started at 7:30 PM on the same venue-local night', () => {
    const event = {
      startDate: '2026-06-19T19:30:00',
      location: {
        name: 'Neighborhood Venue',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    // 9:30 PM Eastern on June 19, 2026
    const captureMs = Date.parse('2026-06-20T01:30:00.000Z');
    expect(jamBaseEventMatchesCapture(event, captureMs)).toBe(true);
  });

  it('rejects capture well after the show window ended', () => {
    const event = {
      startDate: '2026-06-09T20:00:00',
      location: {
        name: 'Brooklyn Steel',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    // 2pm Eastern on June 10 (~18h after start)
    const captureMs = Date.parse('2026-06-10T18:00:00.000Z');
    expect(jamBaseEventMatchesCapture(event, captureMs)).toBe(false);
  });
});
