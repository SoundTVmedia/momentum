import { describe, expect, it } from 'vitest';
import {
  classifyJamBaseEndpoint,
  coalesceInflight,
  jamBaseCacheIsFresh,
  jamBaseCityKey,
  jamBaseCoalesceKey,
  jamBaseEventIsPast,
  jamBaseEventListKey,
  jamBaseGeoListKey,
  jamBaseInflightSize,
  jamBaseListCacheIsFresh,
  jamBaseNameKey,
  JAMBASE_EVENT_CACHE_TTL_MS,
} from './jambase-cache';
import { JAMBASE_NIGHTLY_CRON } from './jambase-prefetch';

describe('JamBase cache policy', () => {
  it('slugifies artist/venue names as permanent map keys', () => {
    expect(jamBaseNameKey('Phish')).toBe('phish');
    expect(jamBaseNameKey('  Madison Square Garden ')).toBe('madison-square-garden');
  });

  it('classifies v3 endpoints for daily metrics', () => {
    expect(classifyJamBaseEndpoint('/artists', { artistName: 'phish' })).toBe('GET /artists');
    expect(classifyJamBaseEndpoint('/artists/jambase:1')).toBe('GET /artists/:id');
    expect(classifyJamBaseEndpoint('/venues', { venueName: 'msg' })).toBe('GET /venues');
    expect(
      classifyJamBaseEndpoint('/venues', {
        geoLatitude: '40.7',
        geoLongitude: '-74',
      }),
    ).toBe('GET /venues (geo)');
    expect(classifyJamBaseEndpoint('/events', { artistId: 'jambase:1' })).toBe(
      'GET /events (artist)',
    );
    expect(classifyJamBaseEndpoint('/events', { venueId: 'jambase:9' })).toBe(
      'GET /events (venue)',
    );
    expect(
      classifyJamBaseEndpoint('/events', {
        geoLatitude: '40.7',
        geoLongitude: '-74',
      }),
    ).toBe('GET /events (geo)');
    expect(classifyJamBaseEndpoint('/geographies/cities', { geoCityName: 'Austin' })).toBe(
      'GET /geographies/cities',
    );
    expect(classifyJamBaseEndpoint('/events/id/jambase:55')).toBe('GET /events/:id');
  });

  it('coalesces equivalent resources even when perPage differs', () => {
    expect(jamBaseCoalesceKey('/artists', { artistName: 'Phish', perPage: '8' })).toBe(
      jamBaseCoalesceKey('/artists', { artistName: 'phish', perPage: '20' }),
    );
    expect(jamBaseCoalesceKey('/events', { artistId: 'jambase:1', perPage: '10' })).toBe(
      jamBaseCoalesceKey('/events', { artistId: 'jambase:1', perPage: '50' }),
    );
    expect(jamBaseEventListKey('artist', 'jambase:1')).toBe('artist:jambase:1');
    expect(jamBaseCityKey('Austin', 'us')).toBe('austin|US');
    expect(jamBaseGeoListKey('events', 40.7505, -73.9934, '15', '2026-08-25')).toBe(
      'events:40.75:-73.99:15:2026-08-25',
    );
  });

  it('treats upcoming events as stale after 72 hours', () => {
    const now = Date.parse('2026-08-25T12:00:00Z');
    const fetched = new Date(now - JAMBASE_EVENT_CACHE_TTL_MS - 1000).toISOString();
    expect(jamBaseCacheIsFresh(fetched, '2026-09-01T00:00:00Z', now)).toBe(false);
    expect(
      jamBaseCacheIsFresh(new Date(now - 60 * 60 * 1000).toISOString(), '2026-09-01T00:00:00Z', now),
    ).toBe(true);
    expect(jamBaseListCacheIsFresh(fetched, now)).toBe(false);
  });

  it('never expires past events', () => {
    const now = Date.parse('2026-08-25T12:00:00Z');
    const fetchedYearsAgo = '2020-01-01T00:00:00Z';
    expect(jamBaseEventIsPast('2026-08-24T12:00:00Z', now)).toBe(true);
    expect(jamBaseCacheIsFresh(fetchedYearsAgo, '2026-08-24T00:00:00Z', now)).toBe(true);
  });

  it('shares one in-flight promise across concurrent callers', async () => {
    let runs = 0;
    const task = () =>
      coalesceInflight('test:same', async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 20));
        return 'ok';
      });
    const [a, b] = await Promise.all([task(), task()]);
    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(runs).toBe(1);
    expect(jamBaseInflightSize()).toBe(0);
  });

  it('schedules the nightly prefetch off-peak', () => {
    expect(JAMBASE_NIGHTLY_CRON).toBe('15 7 * * *');
  });
});
