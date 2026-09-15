import { describe, expect, it } from 'vitest';
import { libraryShowRowFromEvent } from './library-show-endpoints';

describe('libraryShowRowFromEvent', () => {
  it('builds a library stub from JamBase event data', () => {
    const row = libraryShowRowFromEvent(
      {
        identifier: 'jambase:14852021',
        name: 'Ariana Grande at Barclays Center',
        startDate: '2026-07-14T20:00:00',
        image: 'https://cdn.example/ari.jpg',
        performer: [{ name: 'Ariana Grande', identifier: 'jambase:artist', 'x-isHeadliner': true }],
        location: {
          name: 'Barclays Center',
          identifier: 'jambase:venue',
          address: { addressLocality: 'Brooklyn', addressRegion: { alternateName: 'NY' } },
        },
        workPerformed: [{ name: "we can't be friends" }],
      },
      'user-1',
    );

    expect(row?.jambase_event_id).toBe('jambase:14852021');
    expect(row?.artist_name).toBe('Ariana Grande');
    expect(row?.venue_name).toBe('Barclays Center');
    expect(row?.event_title).toBe('Ariana Grande at Barclays Center');
    expect(row?.setlist_json).toContain("we can't be friends");
    expect(row?.added_by).toBe('user-1');
  });
});
