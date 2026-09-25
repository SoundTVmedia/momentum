import { describe, expect, it } from 'vitest';
import {
  clipShowClipsPath,
  festivalPath,
  apiFestivalPath,
  festivalPageHrefFromEvent,
  jamBaseEventShowPath,
  pastShowClipsPath,
  showMarkClipsPath,
} from './app-paths';

describe('pastShowClipsPath', () => {
  it('routes identical event titles on consecutive dates to distinct shows', () => {
    const show = {
      event_title: 'Phish at Madison Square Garden',
      artist_name: 'Phish',
      venue_name: 'Madison Square Garden',
    };

    expect(
      pastShowClipsPath({
        ...show,
        show_id: 'phish-madison-square-garden-2025-04-20',
        show_date: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('/artists/phish/shows/phish-madison-square-garden-2025-04-20/clips');
    expect(
      pastShowClipsPath({
        ...show,
        show_id: 'phish-madison-square-garden-2025-04-21',
        show_date: '2025-04-21T01:00:00.000Z',
      }),
    ).toBe('/artists/phish/shows/phish-madison-square-garden-2025-04-21/clips');
  });

  it('computes a date-aware show id for older API responses', () => {
    expect(
      pastShowClipsPath({
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        show_date: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('/artists/phish/shows/phish-madison-square-garden-2025-04-20/clips');
  });
});

describe('clipShowClipsPath', () => {
  it('opens the exact show represented by the clip', () => {
    expect(
      clipShowClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        timestamp: '2025-04-20T01:00:00.000Z',
        show_id: 'phish-madison-square-garden-2025-04-20',
      }),
    ).toBe('/artists/phish/shows/phish-madison-square-garden-2025-04-20/clips');
  });

  it('prefers a JamBase event id over a composite slug show id', () => {
    expect(
      clipShowClipsPath({
        event_title: 'Ariana Grande at Barclays Center',
        artist_name: 'Ariana Grande',
        venue_name: 'Barclays Center',
        timestamp: '2026-07-14T00:32:47.000Z',
        show_id: 'ariana-grande-barclays-center-2026-07-14',
        jambase_event_id: 'jambase:14852021',
      }),
    ).toBe('/artists/ariana-grande/shows/jambase%3A14852021/clips');
  });

  it('keeps multi-night Phish MSG titles on their own show pages', () => {
    expect(
      clipShowClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        timestamp: '2026-07-28T00:55:35.531Z',
        show_id: 'jambase:15668779',
        jambase_event_id: 'jambase:15668779',
      }),
    ).toBe('/artists/phish/shows/jambase%3A15668779/clips');
    expect(
      clipShowClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        timestamp: '2026-07-26T03:09:35.744Z',
        show_id: 'jambase:15668776',
        jambase_event_id: 'jambase:15668776',
      }),
    ).toBe('/artists/phish/shows/jambase%3A15668776/clips');
    expect(
      clipShowClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        timestamp: '2025-12-29T03:24:42.000Z',
        show_id: 'phish-madison-square-garden-2025-12-29',
        jambase_event_id: null,
      }),
    ).toBe('/artists/phish/shows/phish-madison-square-garden-2025-12-29/clips');
  });

  it('uses the database legacy show key when a clip has no show id', () => {
    expect(
      clipShowClipsPath({
        event_title: 'The Beatles at Abbey Road Studios',
        artist_name: 'The Beatles',
        venue_name: 'Abbey Road Studios',
        timestamp: '2026-07-25T19:00:00.000Z',
        show_id: null,
        jambase_event_id: null,
      }),
    ).toBe(
      '/artists/the-beatles/shows/the%20beatles%7Cabbey%20road%20studios%7C2026-07-25/clips',
    );
  });

  it('opens every Shaky Knees clip on the same festival clips page', () => {
    expect(
      clipShowClipsPath({
        event_title: 'Shaky Knees',
        artist_name: 'OK Go',
        show_id: 'jambase:15698172',
        jambase_event_id: 'jambase:15698172',
      }),
    ).toBe('/events/clips/Shaky%20Knees');
    expect(
      clipShowClipsPath({
        event_title: 'Shaky Knees',
        artist_name: 'Bone Thugs-N-Harmony',
        show_id: null,
        jambase_event_id: null,
      }),
    ).toBe('/events/clips/Shaky%20Knees');
  });

  it('keeps the event-title route when a legacy clip cannot identify a show', () => {
    expect(
      clipShowClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
      }),
    ).toBe('/events/clips/Phish%20at%20Madison%20Square%20Garden');
  });
});

describe('festivalPath', () => {
  it('uses a year-stripped festival slug', () => {
    expect(festivalPath('Bonnaroo Music Festival 2026')).toBe('/festivals/bonnaroo-music-festival');
    expect(apiFestivalPath('Bonnaroo Music Festival 2026')).toBe(
      '/api/festivals/bonnaroo-music-festival',
    );
  });
});

describe('festivalPageHrefFromEvent', () => {
  it('links a festival clips title to the festival page', () => {
    expect(festivalPageHrefFromEvent(null, 'Shaky Knees')).toBe('/festivals/shaky-knees');
    expect(
      festivalPageHrefFromEvent({ name: 'Shaky Knees Festival', '@type': 'Festival' }),
    ).toBe('/festivals/shaky-knees-festival');
  });

  it('returns null for a regular concert', () => {
    expect(festivalPageHrefFromEvent(null, 'Phish at Madison Square Garden')).toBeNull();
  });
});

describe('jamBaseEventShowPath', () => {
  it('routes a JamBase concert to the artist show clips page', () => {
    expect(
      jamBaseEventShowPath({
        identifier: 'jambase:123',
        name: 'Phish at Madison Square Garden',
        startDate: '2026-07-04T20:00:00',
        performer: [{ name: 'Phish', 'x-isHeadliner': true }],
        location: { name: 'Madison Square Garden' },
      }),
    ).toBe('/artists/phish/shows/jambase%3A123/clips');
  });

  it('routes a festival event to the festival page', () => {
    expect(
      jamBaseEventShowPath({
        identifier: 'jambase:fest',
        name: 'Bonnaroo Music Festival 2026',
      }),
    ).toBe('/festivals/bonnaroo-music-festival');
  });
});

describe('showMarkClipsPath', () => {
  it('prefers the artist show page over a title-only event page', () => {
    expect(
      showMarkClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        jambase_event_id: 'jambase:123',
        start_date: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('/artists/phish/shows/jambase%3A123/clips');
  });
});
