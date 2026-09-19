import { describe, expect, it } from 'vitest';
import {
  inferTimezoneFromCoords,
  jamBaseEventLocalYmd,
  jamBaseEventMatchesCapture,
  jamBaseEventOnCaptureDay,
  jamBaseEventCameraCaptureDay,
  jamBaseEventFeedVisible,
  jamBaseEventInProgress,
  jamBaseEventImThereEligible,
  jamBaseEventUpcomingOrInProgress,
  jamBaseEventIsConcluded,
  jamBaseEventAfterToday,
  jamBaseGeoEventDateFromForUpcomingFeed,
  jamBaseGeoEventDateFromForResolveShow,
  isPastCaptureAnchor,
  nextCalendarDayYmdInTimeZone,
  jamBaseEventSameCalendarDay,
  jamBaseEventStartMs,
  jamBaseEventShouldOfferTickets,
  jamBaseEventUsesFestivalRunWindow,
  jamBaseEventOnFestivalRunDay,
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

  it('matches capture up to four hours after start while the show is ongoing', () => {
    const event = {
      startDate: '2026-06-09T20:00:00',
      location: {
        name: 'Brooklyn Steel',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    // 11pm Eastern on June 9 (~3h after an 8pm start)
    const captureMs = Date.parse('2026-06-10T03:00:00.000Z');
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

describe('jamBaseEventSameCalendarDay', () => {
  const event = {
    startDate: '2026-06-19T19:30:00',
    location: {
      name: 'Neighborhood Venue',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('matches capture on the same venue-local date', () => {
    const captureMs = Date.parse('2026-06-20T01:30:00.000Z'); // 9:30pm Eastern June 19
    expect(jamBaseEventSameCalendarDay(event, captureMs)).toBe(true);
  });

  it('rejects capture on the next venue-local date', () => {
    const captureMs = Date.parse('2026-06-20T18:00:00.000Z'); // 2pm Eastern June 20
    expect(jamBaseEventSameCalendarDay(event, captureMs)).toBe(false);
    expect(jamBaseEventMatchesCapture(event, captureMs)).toBe(false);
  });
});

describe('jamBaseEventFeedVisible', () => {
  const event = {
    startDate: '2026-06-20T19:30:00',
    location: {
      name: 'Neighborhood Venue',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('includes in-progress show within four hours of start on the same date', () => {
    const captureMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20
    expect(jamBaseEventFeedVisible(event, captureMs)).toBe(true);
  });

  it('excludes show that started more than four hours ago on the same date', () => {
    const morningShow = {
      startDate: '2026-06-20T09:00:00',
      location: event.location,
    };
    const captureMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20
    expect(jamBaseEventFeedVisible(morningShow, captureMs)).toBe(false);
  });
});

describe('jamBaseEventInProgress', () => {
  const event = {
    startDate: '2026-06-20T19:30:00',
    location: {
      name: 'Neighborhood Venue',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('is true within four hours of start', () => {
    const nowMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20
    expect(jamBaseEventInProgress(event, nowMs)).toBe(true);
  });

  it('is false before doors', () => {
    const nowMs = Date.parse('2026-06-20T20:00:00.000Z'); // 4pm Eastern June 20
    expect(jamBaseEventInProgress(event, nowMs)).toBe(false);
  });

  it('is false more than four hours after start', () => {
    const morningShow = {
      startDate: '2026-06-20T09:00:00',
      location: event.location,
    };
    const nowMs = Date.parse('2026-06-21T00:00:00.000Z');
    expect(jamBaseEventInProgress(morningShow, nowMs)).toBe(false);
  });
});

describe('jamBaseEventImThereEligible', () => {
  const event = {
    startDate: '2026-08-28T20:00:00',
    location: { name: 'Brooklyn Steel' },
  };

  it('includes tonight\'s show after UTC midnight when timezone is missing', () => {
    const nowMs = Date.parse('2026-08-29T00:25:00.000Z');
    expect(jamBaseEventImThereEligible(event, nowMs)).toBe(true);
  });
});

describe('jamBaseEventUpcomingOrInProgress', () => {
  const event = {
    startDate: '2026-06-20T19:30:00',
    location: {
      name: 'Neighborhood Venue',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('includes future shows', () => {
    const nowMs = Date.parse('2026-06-10T12:00:00.000Z');
    expect(jamBaseEventUpcomingOrInProgress(event, nowMs)).toBe(true);
  });

  it('includes in-progress show within four hours of start', () => {
    const nowMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20
    expect(jamBaseEventUpcomingOrInProgress(event, nowMs)).toBe(true);
  });

  it('excludes show that started more than four hours ago', () => {
    const morningShow = {
      startDate: '2026-06-20T09:00:00',
      location: event.location,
    };
    const nowMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20
    expect(jamBaseEventUpcomingOrInProgress(morningShow, nowMs)).toBe(false);
  });
});

describe('jamBaseEventAfterToday', () => {
  const tonightShow = {
    startDate: '2026-06-20T19:30:00',
    location: {
      name: 'Neighborhood Venue',
      address: { 'x-timezone': 'America/New_York' },
    },
  };
  const tomorrowShow = {
    startDate: '2026-06-21T19:30:00',
    location: tonightShow.location,
  };

  it('excludes same-day show (Tonight section owns those)', () => {
    const nowMs = Date.parse('2026-06-20T20:00:00.000Z'); // 4pm Eastern June 20
    expect(jamBaseEventAfterToday(tonightShow, nowMs)).toBe(false);
  });

  it('includes tomorrow show', () => {
    const nowMs = Date.parse('2026-06-20T20:00:00.000Z');
    expect(jamBaseEventAfterToday(tomorrowShow, nowMs)).toBe(true);
  });

  it('excludes in-progress show tonight', () => {
    const nowMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20
    expect(jamBaseEventAfterToday(tonightShow, nowMs)).toBe(false);
  });
});

describe('jamBaseGeoEventDateFromForUpcomingFeed', () => {
  it('returns tomorrow in user timezone', () => {
    const captureMs = Date.parse('2026-06-20T20:00:00.000Z'); // 4pm Eastern June 20
    expect(jamBaseGeoEventDateFromForUpcomingFeed(captureMs, 40.7, -74.0)).toBe('2026-06-21');
  });
});

describe('isPastCaptureAnchor', () => {
  it('treats capture more than six hours ago as past', () => {
    const nowMs = Date.parse('2026-06-22T12:00:00.000Z');
    const captureMs = Date.parse('2026-06-21T20:00:00.000Z');
    expect(isPastCaptureAnchor(captureMs, nowMs)).toBe(true);
  });

  it('treats recent capture as live', () => {
    const nowMs = Date.parse('2026-06-22T12:00:00.000Z');
    const captureMs = Date.parse('2026-06-22T10:00:00.000Z');
    expect(isPastCaptureAnchor(captureMs, nowMs)).toBe(false);
  });
});

describe('jamBaseGeoEventDateFromForResolveShow', () => {
  it('uses capture-local day for past library uploads', () => {
    const captureMs = Date.parse('2026-06-20T03:30:00.000Z'); // June 19 evening Eastern
    const nowMs = Date.parse('2026-06-22T12:00:00.000Z');
    expect(isPastCaptureAnchor(captureMs, nowMs)).toBe(true);
    expect(jamBaseGeoEventDateFromForResolveShow(captureMs, 40.73, -73.99, nowMs)).toBe(
      '2026-06-19',
    );
  });
});

describe('jamBaseEventIsConcluded', () => {
  const event = {
    startDate: '2026-06-09T20:00:00',
    location: {
      name: 'Brooklyn Steel',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('is false for upcoming and in-progress shows', () => {
    expect(jamBaseEventIsConcluded(event, Date.parse('2026-06-09T20:00:00.000Z'))).toBe(false);
    expect(jamBaseEventIsConcluded(event, Date.parse('2026-06-10T02:00:00.000Z'))).toBe(false);
  });

  it('is true after the show window has ended', () => {
    expect(jamBaseEventIsConcluded(event, Date.parse('2026-06-10T12:00:00.000Z'))).toBe(true);
  });
});

describe('nextCalendarDayYmdInTimeZone', () => {
  it('steps to next day', () => {
    expect(nextCalendarDayYmdInTimeZone('2026-06-20', 'America/New_York')).toBe('2026-06-21');
  });
});

describe('jamBaseEventCameraCaptureDay', () => {
  const event = {
    startDate: '2026-06-20T19:30:00',
    location: {
      name: 'Neighborhood Venue',
      address: { 'x-timezone': 'America/New_York' },
    },
  };

  it('includes in-progress show within ten hours of start on the same date', () => {
    const captureMs = Date.parse('2026-06-21T02:00:00.000Z'); // 10pm Eastern June 20
    expect(jamBaseEventCameraCaptureDay(event, captureMs)).toBe(true);
  });

  it('includes upcoming show later today', () => {
    const captureMs = Date.parse('2026-06-20T20:00:00.000Z'); // 4pm Eastern June 20
    expect(jamBaseEventCameraCaptureDay(event, captureMs)).toBe(true);
  });

  it('rejects show that started more than ten hours ago on the same date', () => {
    const morningShow = {
      startDate: '2026-06-20T09:00:00',
      location: event.location,
    };
    const captureMs = Date.parse('2026-06-21T00:00:00.000Z'); // 8pm Eastern June 20 (~11h after 9am start)
    expect(jamBaseEventCameraCaptureDay(morningShow, captureMs)).toBe(false);
  });

  it('rejects yesterday show even if within ten hours of start', () => {
    const yesterday = {
      startDate: '2026-06-19T19:30:00',
      location: event.location,
    };
    const captureMs = Date.parse('2026-06-20T20:00:00.000Z'); // 4pm Eastern June 20
    expect(jamBaseEventCameraCaptureDay(yesterday, captureMs)).toBe(false);
  });
});

describe('festival run window (Shaky Knees-style date-only start/end)', () => {
  const festival = {
    identifier: 'jambase:15698172',
    name: 'Shaky Knees',
    '@type': 'Festival',
    startDate: '2026-09-18',
    endDate: '2026-09-20',
    location: {
      name: 'Piedmont Park',
      address: { 'x-timezone': 'America/New_York' },
    },
  };
  const morningStart = Date.parse('2026-09-18T14:00:00.000Z'); // 10am ET Sept 18
  const dayTwo = Date.parse('2026-09-19T19:00:00.000Z'); // 3pm ET Sept 19
  const lastNight = Date.parse('2026-09-21T00:00:00.000Z'); // 8pm ET Sept 20
  const afterClose = Date.parse('2026-09-21T14:00:00.000Z'); // 10am ET Sept 21
  const beforeGates = Date.parse('2026-09-17T23:00:00.000Z'); // 7pm ET Sept 17

  it('detects the festival run window', () => {
    expect(jamBaseEventUsesFestivalRunWindow(festival)).toBe(true);
  });

  it('is I\'m-there on the start date, middle day, and last day', () => {
    expect(jamBaseEventOnFestivalRunDay(festival, morningStart)).toBe(true);
    expect(jamBaseEventImThereEligible(festival, morningStart)).toBe(true);
    expect(jamBaseEventImThereEligible(festival, dayTwo)).toBe(true);
    expect(jamBaseEventImThereEligible(festival, lastNight)).toBe(true);
    expect(jamBaseEventInProgress(festival, dayTwo)).toBe(true);
  });

  it('stays upcoming/in-progress through the last day, then concludes', () => {
    expect(jamBaseEventUpcomingOrInProgress(festival, beforeGates)).toBe(true);
    expect(jamBaseEventImThereEligible(festival, beforeGates)).toBe(false);
    expect(jamBaseEventUpcomingOrInProgress(festival, dayTwo)).toBe(true);
    expect(jamBaseEventIsConcluded(festival, dayTwo)).toBe(false);
    expect(jamBaseEventIsConcluded(festival, afterClose)).toBe(true);
    expect(jamBaseEventImThereEligible(festival, afterClose)).toBe(false);
  });

  it('hides tickets while the festival is in progress', () => {
    expect(jamBaseEventShouldOfferTickets(festival, beforeGates)).toBe(true);
    expect(jamBaseEventShouldOfferTickets(festival, morningStart)).toBe(false);
    expect(jamBaseEventShouldOfferTickets(festival, dayTwo)).toBe(false);
    expect(jamBaseEventShouldOfferTickets(festival, afterClose)).toBe(false);
  });

  it('matches clips captured on any day of the run', () => {
    expect(jamBaseEventMatchesCapture(festival, morningStart)).toBe(true);
    expect(jamBaseEventMatchesCapture(festival, dayTwo)).toBe(true);
    expect(jamBaseEventCameraCaptureDay(festival, dayTwo)).toBe(true);
    expect(jamBaseEventMatchesCapture(festival, afterClose)).toBe(false);
  });

  it('keeps date-only festival marks I\'m-there through a 3-day run without endDate', () => {
    const markEvent = {
      name: 'Shaky Knees',
      startDate: '2026-09-18',
    };
    const lastDayUtc = Date.parse('2026-09-20T18:00:00.000Z');
    expect(jamBaseEventImThereEligible(markEvent, morningStart)).toBe(true);
    expect(jamBaseEventImThereEligible(markEvent, dayTwo)).toBe(true);
    expect(jamBaseEventImThereEligible(markEvent, lastDayUtc)).toBe(true);
    expect(jamBaseEventImThereEligible(markEvent, afterClose)).toBe(false);
    expect(jamBaseEventMatchesCapture(markEvent, dayTwo)).toBe(true);
  });

  it('does not treat a single-night concert as a multi-day festival', () => {
    const concert = {
      name: 'Phish at Madison Square Garden',
      startDate: '2026-09-18T19:30:00',
      location: {
        name: 'Madison Square Garden',
        address: { 'x-timezone': 'America/New_York' },
      },
    };
    expect(jamBaseEventUsesFestivalRunWindow(concert)).toBe(false);
    expect(jamBaseEventImThereEligible(concert, morningStart)).toBe(false);
    expect(jamBaseEventImThereEligible(concert, Date.parse('2026-09-18T23:45:00.000Z'))).toBe(true);
    expect(jamBaseEventImThereEligible(concert, Date.parse('2026-09-19T19:00:00.000Z'))).toBe(false);
    expect(jamBaseEventShouldOfferTickets(concert, morningStart)).toBe(true);
    expect(jamBaseEventShouldOfferTickets(concert, Date.parse('2026-09-18T23:45:00.000Z'))).toBe(
      true,
    );
  });
});
