import { describe, expect, it } from 'vitest';
import { clipShowClipsPath, pastShowClipsPath } from './app-paths';

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

  it('computes a date-aware show route when a legacy clip has no show id', () => {
    expect(
      clipShowClipsPath({
        event_title: 'Phish at Madison Square Garden',
        artist_name: 'Phish',
        venue_name: 'Madison Square Garden',
        timestamp: '2025-04-21T01:00:00.000Z',
      }),
    ).toBe('/artists/phish/shows/phish-madison-square-garden-2025-04-21/clips');
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
