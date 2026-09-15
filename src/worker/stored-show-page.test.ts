import { describe, expect, it } from 'vitest';
import { loadStoredShowPage } from './stored-show-page';

function makeDb(rows: {
  library?: { payload: string | null; setlist_json: string | null } | null;
  cached?: { payload: string | null; setlist_json: string | null } | null;
}): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (/FROM library_shows/i.test(sql)) return rows.library ?? null;
              if (/FROM jambase_events/i.test(sql)) return rows.cached ?? null;
              return null;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('loadStoredShowPage', () => {
  it('prefers library_shows and stamps x-setlist onto the event', async () => {
    const page = await loadStoredShowPage(
      makeDb({
        library: {
          payload: JSON.stringify({ identifier: 'jambase:1', name: 'Phish at MSG' }),
          setlist_json: JSON.stringify({
            songs: [{ title: 'Tweezer' }],
            url: 'https://www.setlist.fm/phish',
          }),
        },
      }),
      'jambase:1',
    );
    expect(page?.setlist).toEqual([{ title: 'Tweezer' }]);
    expect(page?.setlist_url).toBeNull();
    expect(page?.htmlChecked).toBe(false);
    expect(page?.event['x-setlist']).toEqual([{ title: 'Tweezer' }]);
  });

  it('falls back to jambase_events payload when the library row is missing', async () => {
    const page = await loadStoredShowPage(
      makeDb({
        library: null,
        cached: {
          payload: JSON.stringify({
            identifier: 'jambase:2',
            workPerformed: [{ name: 'Wilson' }],
          }),
          setlist_json: null,
        },
      }),
      'jambase:2',
    );
    expect(page?.setlist.map((s) => s.title)).toEqual(['Wilson']);
  });
});
