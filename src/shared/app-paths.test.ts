import { describe, expect, it } from 'vitest';
import { pastShowClipsPath } from './app-paths';

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
