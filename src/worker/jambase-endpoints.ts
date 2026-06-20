import { Context } from 'hono';
import {
  jamBaseFetch,
  jamBaseEventDateFromToday,
  jamBaseApiKeyConfigured,
  jamBaseMissingKeyNotice,
  jamBaseQuotaFromEnv,
  jamBaseUpstreamFailureNotice,
  type JamBaseFetchDiag,
  type JamBaseQuotaContext,
} from './jambase-client';
import { cacheJsonProxy, noCache } from './performance-utils';
import { buildTightJamBaseEventResults } from './jambase-events-search';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
} from '../shared/jambase-slug';
import {
  jamBaseEventUpcomingOrInProgress,
  jamBaseVenueEventLookbackDateFrom,
} from '../shared/jambase-event-day';

/**
 * JamBase Data API v3 — proxy endpoints for the SPA.
 * @see https://data.jambase.com/api/docs/getting-started
 */

/** Public config check with a lightweight upstream probe (edge-cached). */
export async function getJamBaseStatus(c: Context) {
  cacheJsonProxy(c, { browserMaxAge: 30, cdnMaxAge: 60 });
  const key = c.env.JAMBASE_API_KEY;
  const configured = jamBaseApiKeyConfigured(key);
  let upstreamOk: boolean | null = null;
  let upstreamHint: string | null = null;
  const diag: JamBaseFetchDiag = {};

  if (configured) {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const probe = await jamBaseFetch<{ artists?: unknown[] }>(
      key,
      '/artists',
      { artistName: 'taylor', perPage: '1', page: '1' },
      jbQ,
      diag,
      { bypassEdgeCache: true },
    );
    upstreamOk = probe != null && !diag.failure;
    if (!upstreamOk) {
      upstreamHint =
        jamBaseUpstreamFailureNotice(key, diag) ??
        'JamBase upstream probe failed. Regenerate JAMBASE_API_KEY at data.jambase.com.';
    }
  }

  return c.json({
    configured,
    upstreamOk,
    upstreamHttpStatus: diag?.httpStatus ?? null,
    upstreamFailure: diag?.failure ?? null,
    upstreamDetail: diag?.httpDetail ?? null,
    upstreamHint,
    apiVersion: 3,
    baseUrl: 'https://api.data.jambase.com/v3',
    hint: !configured
      ? jamBaseMissingKeyNotice()
      : upstreamOk
        ? 'JamBase API key is loaded and upstream responded OK.'
        : (upstreamHint ??
          'API key is loaded but upstream check failed. Use GET /api/jambase/connection-test (signed in) for details.'),
  });
}

/** Authenticated smoke test: one geo `/venues` call using server `JAMBASE_API_KEY` (key is never returned). */
export async function connectionTest(c: Context) {
  noCache(c);
  const key = c.env.JAMBASE_API_KEY;
  if (!key?.trim()) {
    return c.json({
      ok: false,
      apiKeyConfigured: false,
      jamBase: null,
      hint: 'Set JAMBASE_API_KEY in .dev.vars (or Wrangler secrets) and restart the worker.',
    });
  }

  const diag: JamBaseFetchDiag = {};
  const jbQ = jamBaseQuotaFromEnv(c.env);
  const data = await jamBaseFetch<{ venues?: unknown[] }>(
    key,
    '/venues',
    {
      geoLatitude: '40.7505',
      geoLongitude: '-73.9934',
      geoRadiusAmount: '15',
      geoRadiusUnits: 'mi',
      perPage: '2',
      page: '1',
    },
    jbQ,
    diag,
    { bypassEdgeCache: true },
  );

  const venueCount = Array.isArray(data?.venues) ? data.venues.length : 0;
  const ok = data != null;

  let hint = '';
  if (ok) {
    hint =
      'JamBase returned JSON for a fixed NYC test query. Your key is valid for Data API v3 /venues.';
  } else {
    switch (diag.failure) {
      case 'quota':
        hint = 'JamBase quota precheck blocked the call (JAMBASE_QUOTA_ENFORCEMENT). Raise max or disable for local dev.';
        break;
      case 'http':
        hint =
          diag.httpStatus === 401 || diag.httpStatus === 403
            ? 'JamBase rejected the token (401/403). Regenerate the key at data.jambase.com and update JAMBASE_API_KEY.'
            : `JamBase HTTP ${diag.httpStatus ?? 'error'}. See worker logs for the response body.`;
        break;
      case 'network':
        hint = 'Worker could not reach api.data.jambase.com (network/TLS).';
        break;
      case 'non_json':
        hint = 'Response was not JSON (unusual for JamBase). Check worker logs.';
        break;
      case 'api_error':
        hint = 'JamBase JSON had success: false. Check worker logs for errors[].';
        break;
      default:
        hint = 'See worker logs. Common causes: wrong key, quota, or outbound fetch blocked.';
    }
  }

  return c.json({
    ok,
    apiKeyConfigured: true,
    jamBase: {
      venuesReturned: venueCount,
      failureType: diag.failure ?? null,
      httpStatus: diag.httpStatus ?? null,
    },
    hint,
  });
}

export async function searchArtists(c: Context) {
  const query = c.req.query('q') || '';
  const perPage = c.req.query('limit') || c.req.query('perPage') || '20';

  if (!query || query.length < 2) {
    cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
    return c.json({ artists: [] });
  }

  try {
    const key = c.env.JAMBASE_API_KEY;
    if (!key?.trim()) {
      cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
      return c.json({ artists: [], notice: 'JamBase is not configured (missing JAMBASE_API_KEY).' });
    }

    const jbQ = jamBaseQuotaFromEnv(c.env);
    const diag: JamBaseFetchDiag = {};
    const data = await jamBaseFetch<{ artists?: unknown[] }>(
      key,
      '/artists',
      {
        artistName: query,
        page: c.req.query('page') || '1',
        perPage,
      },
      jbQ,
      diag,
    );

    if (!data) {
      cacheJsonProxy(c, { browserMaxAge: 120, cdnMaxAge: 300 });
      return c.json({
        artists: [],
        notice:
          jamBaseUpstreamFailureNotice(key, diag) ??
          'JamBase did not return artist results (API error or upstream unavailable). Check worker logs and JAMBASE_API_KEY.',
      });
    }

    cacheJsonProxy(c, { browserMaxAge: 1800, cdnMaxAge: 28_800 });
    return c.json({
      artists: data.artists || [],
      pagination: {},
    });
  } catch (error) {
    console.error('JamBase artist search error:', error);
    return c.json({ error: 'Failed to search artists', artists: [] }, 500);
  }
}

export async function searchVenues(c: Context) {
  const query = c.req.query('q') || '';
  const location = (c.req.query('location') || '').trim();
  const country = ((c.req.query('country') || 'US').trim().slice(0, 2) || 'US').toUpperCase();
  const perPage = c.req.query('limit') || c.req.query('perPage') || '20';

  if (!query && !location) {
    cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
    return c.json({ venues: [] });
  }

  try {
    const key = c.env.JAMBASE_API_KEY;
    if (!key?.trim()) {
      cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
      return c.json({ venues: [], notice: 'JamBase is not configured (missing JAMBASE_API_KEY).' });
    }

    const jbQ = jamBaseQuotaFromEnv(c.env);
    const params: Record<string, string> = {
      page: c.req.query('page') || '1',
      perPage,
    };
    if (query) params.venueName = query;
    /** v3 `/venues` requires `venueName` or a geo filter — city alone must use geoCityName + country. */
    if (location) {
      params.geoCityName = location;
      params.geoCountryIso2 = country;
    }

    const data = await jamBaseFetch<{ venues?: unknown[] }>(key, '/venues', params, jbQ);

    if (!data) {
      cacheJsonProxy(c, { browserMaxAge: 120, cdnMaxAge: 300 });
      return c.json({
        venues: [],
        notice:
          'JamBase did not return venue results (invalid request, API error, or upstream unavailable). Check worker logs.',
      });
    }

    cacheJsonProxy(c, { browserMaxAge: 1800, cdnMaxAge: 28_800 });
    return c.json({
      venues: data.venues || [],
      pagination: {},
    });
  } catch (error) {
    console.error('JamBase venue search error:', error);
    return c.json({ error: 'Failed to search venues', venues: [] }, 500);
  }
}

export async function getArtistTourDates(c: Context) {
  const artistId = c.req.param('artistId');
  const perPage = c.req.query('limit') || c.req.query('perPage') || '50';

  if (!artistId) {
    return c.json({ error: 'artistId is required', events: [] }, 400);
  }

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const data = await jamBaseFetch<{ events?: unknown[] }>(
      c.env.JAMBASE_API_KEY,
      '/events',
      {
        artistId,
        eventDateFrom: jamBaseEventDateFromToday(),
        page: c.req.query('page') || '1',
        perPage,
      },
      jbQ
    );

    cacheJsonProxy(c, { browserMaxAge: 900, cdnMaxAge: 7200 });
    return c.json({
      events: data?.events || [],
      pagination: {},
    });
  } catch (error) {
    console.error('JamBase tour dates error:', error);
    return c.json({ error: 'Failed to fetch tour dates', events: [] }, 500);
  }
}

/** v3 geo matching for clip auto-tag is not available with the same params as legacy v1. */
export async function matchEventsByLocation(c: Context) {
  cacheJsonProxy(c, { browserMaxAge: 600, cdnMaxAge: 3600 });
  return c.json({
    events: [],
    matchCount: 0,
    notice:
      'Geo-based event matching requires a metro or city id in JamBase v3; use geographies endpoints first.',
  });
}

export async function getUpcomingEvents(c: Context) {
  const perPage = c.req.query('limit') || c.req.query('perPage') || '30';
  const page = c.req.query('page') || '1';

  try {
    const params: Record<string, string> = {
      page,
      perPage,
      eventDateFrom: c.req.query('eventDateFrom') || jamBaseEventDateFromToday(),
    };

    const genre = c.req.query('genre') || '';
    if (genre) params.genreSlug = genre;

    const artistName = c.req.query('artistName') || '';
    const venueId = c.req.query('venueId') || '';
    const geoMetroId = c.req.query('geoMetroId') || '';
    const geoCityId = c.req.query('geoCityId') || '';
    if (artistName) params.artistName = artistName;
    if (venueId) params.venueId = venueId;
    if (geoMetroId) params.geoMetroId = geoMetroId;
    if (geoCityId) params.geoCityId = geoCityId;

    const jbQ = jamBaseQuotaFromEnv(c.env);
    const data = await jamBaseFetch<{ events?: unknown[] }>(
      c.env.JAMBASE_API_KEY,
      '/events',
      params,
      jbQ
    );

    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 3600 });
    return c.json({
      events: data?.events || [],
      pagination: {},
    });
  } catch (error) {
    console.error('JamBase upcoming events error:', error);
    return c.json({ error: 'Failed to fetch upcoming events', events: [] }, 500);
  }
}

export async function getArtistById(c: Context) {
  const raw = c.req.param('artistId');
  if (!raw) {
    return c.json({ error: 'artistId is required' }, 400);
  }
  const artistId = encodeURIComponent(raw);

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const data = await jamBaseFetch<Record<string, unknown>>(
      c.env.JAMBASE_API_KEY,
      `/artists/${artistId}`,
      {},
      jbQ
    );

    if (!data) {
      return c.json({ error: 'Artist not found or unavailable for this key' }, 404);
    }

    cacheJsonProxy(c, { browserMaxAge: 3600, cdnMaxAge: 86_400 });
    return c.json(data);
  } catch (error) {
    console.error('JamBase artist details error:', error);
    return c.json({ error: 'Failed to fetch artist details' }, 500);
  }
}

export async function getVenueById(c: Context) {
  const raw = c.req.param('venueId');
  if (!raw) {
    return c.json({ error: 'venueId is required' }, 400);
  }
  const venueId = encodeURIComponent(raw);

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const data = await jamBaseFetch<Record<string, unknown>>(
      c.env.JAMBASE_API_KEY,
      `/venues/${venueId}`,
      {},
      jbQ
    );

    if (!data) {
      return c.json({ error: 'Venue not found or unavailable for this key' }, 404);
    }

    cacheJsonProxy(c, { browserMaxAge: 3600, cdnMaxAge: 86_400 });
    return c.json(data);
  } catch (error) {
    console.error('JamBase venue details error:', error);
    return c.json({ error: 'Failed to fetch venue details' }, 500);
  }
}

export async function searchEvents(c: Context) {
  const q = (c.req.query('q') || '').trim();
  const max = Math.min(parseInt(c.req.query('perPage') || c.req.query('limit') || '20', 10) || 20, 40);

  if (q.length < 2) {
    cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
    return c.json({ events: [] });
  }

  try {
    const key = c.env.JAMBASE_API_KEY;
    if (!key?.trim()) {
      cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
      return c.json({ events: [] });
    }

    const jbQ = jamBaseQuotaFromEnv(c.env);
    if (c.req.query('loose') === '1') {
      const data = await jamBaseFetch<{ events?: unknown[] }>(
        key,
        '/events',
        {
          artistName: q,
          eventDateFrom: c.req.query('eventDateFrom') || jamBaseEventDateFromToday(),
          page: c.req.query('page') || '1',
          perPage: String(max),
        },
        jbQ
      );
      cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 3600 });
      return c.json({ events: data?.events || [] });
    }

    const events = await buildTightJamBaseEventResults(key, q, max, jbQ);
    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 3600 });
    return c.json({ events });
  } catch (error) {
    console.error('JamBase event search error:', error);
    return c.json({ error: 'Failed to search events', events: [] }, 500);
  }
}

/** Browse upcoming shows: metro, city lookup, or artist filter — defaults to NYC metro. */
export async function getLiveTabEvents(c: Context) {
  const key = c.env.JAMBASE_API_KEY;
  if (!key?.trim()) {
    cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
    return c.json({ events: [], notice: 'JamBase is not configured' });
  }

  const perPage = c.req.query('perPage') || '24';
  const page = c.req.query('page') || '1';
  const genreSlug = (c.req.query('genreSlug') || c.req.query('genre') || '').trim();
  const artistName = (c.req.query('artistName') || '').trim();
  const metro = (c.req.query('geoMetroId') || '').trim();
  const city = (c.req.query('city') || '').trim();
  const country = ((c.req.query('country') || 'US').trim().slice(0, 2) || 'US').toUpperCase();

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const params: Record<string, string> = {
      eventDateFrom: c.req.query('eventDateFrom') || jamBaseEventDateFromToday(),
      perPage,
      page,
    };
    if (genreSlug) params.genreSlug = genreSlug;

    if (artistName) {
      params.artistName = artistName;
    } else if (metro) {
      params.geoMetroId = metro;
    } else if (city) {
      const cities = await jamBaseFetch<{ cities?: Record<string, unknown>[] }>(
        key,
        '/geographies/cities',
        {
          geoCityName: city,
          geoCountryIso2: country,
        },
        jbQ
      );
      const first = cities?.cities?.[0];
      if (first && typeof first.identifier === 'string') {
        params.geoCityId = first.identifier;
      } else {
        params.geoMetroId = 'jambase:1';
      }
    } else {
      params.geoMetroId = 'jambase:1';
    }

    const data = await jamBaseFetch<{ events?: unknown[] }>(key, '/events', params, jbQ);
    if (!data) {
      cacheJsonProxy(c, { browserMaxAge: 120, cdnMaxAge: 300 });
      return c.json({
        events: [],
        notice:
          'JamBase did not return events (missing/invalid API key, upstream error, or quota if enabled). Check JAMBASE_API_KEY and worker logs.',
        meta: { geoMetroId: params.geoMetroId, geoCityId: params.geoCityId, artistName: params.artistName },
      });
    }
    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 3600 });
    return c.json({
      events: data.events ?? [],
      meta: { geoMetroId: params.geoMetroId, geoCityId: params.geoCityId, artistName: params.artistName },
    });
  } catch (error) {
    console.error('JamBase live-tab error:', error);
    return c.json({ error: 'Failed to load events', events: [] }, 500);
  }
}

/**
 * Resolve JamBase upcoming events for a single artist display name (worker-internal; no HTTP cache).
 */
function mergeJamBaseFetchDiag(target: JamBaseFetchDiag, call: JamBaseFetchDiag): void {
  if (!target.failure && call.failure) {
    target.failure = call.failure;
    target.httpStatus = call.httpStatus;
  }
}

function unwrapJamBaseEventPayload(data: Record<string, unknown>): Record<string, unknown> | null {
  const nested = data.event;
  if (typeof nested === 'object' && nested !== null) {
    return nested as Record<string, unknown>;
  }
  if (typeof data.identifier === 'string' || typeof data.name === 'string') {
    return data;
  }
  return null;
}

/** GET /v3/events/id/{source}:{id} — full event including image, performers, offers. */
export async function fetchJamBaseEventById(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  eventId: string,
): Promise<Record<string, unknown> | null> {
  const id = eventId.trim();
  if (!id) return null;

  const paths = [
    `/events/id/${encodeURIComponent(id)}`,
    `/events/${encodeURIComponent(id)}`,
  ];

  for (const path of paths) {
    const data = await jamBaseFetch<Record<string, unknown>>(apiKey, path, {}, jbQ);
    if (!data) continue;
    const ev = unwrapJamBaseEventPayload(data);
    if (ev) return ev;
  }

  return null;
}

export async function fetchJamBaseEventsByArtistName(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  raw: string,
  perPage: string,
  page = '1',
  diag?: JamBaseFetchDiag,
): Promise<{
  events: Record<string, unknown>[];
  artist: { name: unknown; identifier: string } | null;
}> {
  const trim = raw.trim();
  if (!trim) {
    return { events: [], artist: null };
  }

  const slug = slugifyEntityName(trim) || normalizedSlugFromRouteParam(trim);
  const phrase = searchPhraseFromSlug(slug);

  const searchArtists = async (artistNameTerm: string) => {
    const call: JamBaseFetchDiag = {};
    const data = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(
      apiKey,
      '/artists',
      {
        artistName: artistNameTerm,
        perPage: '8',
        page: '1',
      },
      jbQ,
      call,
    );
    if (diag) mergeJamBaseFetchDiag(diag, call);
    return data?.artists ?? [];
  };

  let artists = await searchArtists(phrase || trim);
  if (!artists.length && trim.toLowerCase() !== (phrase || '').toLowerCase()) {
    artists = await searchArtists(trim);
  }
  if (!artists.length) {
    return { events: [], artist: null };
  }

  const exact = artists.find((a) => slugifyEntityName(String(a.name)) === slug);
  const pick = exact || artists[0];
  const id = pick?.identifier;
  if (typeof id !== 'string') {
    return { events: [], artist: null };
  }

  const evCall: JamBaseFetchDiag = {};
  const ev = await jamBaseFetch<{ events?: unknown[] }>(
    apiKey,
    '/events',
    {
      artistId: id,
      eventDateFrom: jamBaseVenueEventLookbackDateFrom(),
      expandPastEvents: 'true',
      perPage,
      page,
    },
    jbQ,
    evCall,
  );
  if (diag) mergeJamBaseFetchDiag(diag, evCall);

  const nowMs = Date.now();
  const rawEvents = ev?.events ?? [];
  const events = rawEvents.filter(
    (e): e is Record<string, unknown> =>
      typeof e === 'object' &&
      e !== null &&
      jamBaseEventUpcomingOrInProgress(e as Record<string, unknown>, nowMs),
  );

  return {
    events,
    artist: { name: pick.name, identifier: id },
  };
}

/**
 * Resolve JamBase upcoming events for a venue display name (search /venues → /events).
 */
export async function fetchJamBaseEventsByVenueName(
  apiKey: string,
  jbQ: JamBaseQuotaContext | undefined,
  raw: string,
  perPage: string,
  page = '1',
  diag?: JamBaseFetchDiag,
): Promise<{
  events: Record<string, unknown>[];
  venue: { name: unknown; identifier: string } | null;
}> {
  const trim = raw.trim();
  if (!trim) {
    return { events: [], venue: null };
  }

  const slug = slugifyEntityName(trim) || normalizedSlugFromRouteParam(trim);
  const phraseFromSlug = searchPhraseFromSlug(slug);

  const searchOnce = async (venueNameTerm: string) => {
    const call: JamBaseFetchDiag = {};
    const data = await jamBaseFetch<{ venues?: Record<string, unknown>[] }>(
      apiKey,
      '/venues',
      {
        venueName: venueNameTerm,
        perPage: '18',
        page: '1',
      },
      jbQ,
      call,
    );
    if (diag) mergeJamBaseFetchDiag(diag, call);
    return data;
  };

  let venues = (await searchOnce(phraseFromSlug || trim))?.venues ?? [];
  if (!venues.length && trim.toLowerCase() !== (phraseFromSlug || '').toLowerCase()) {
    venues = (await searchOnce(trim))?.venues ?? [];
  }

  if (!venues.length) {
    return { events: [], venue: null };
  }

  const exact =
    venues.find((v) => slugifyEntityName(String(v.name)) === slug) ??
    venues.find((v) => String(v?.name ?? '').trim().toLowerCase() === trim.toLowerCase());
  const pick = exact ?? venues[0];
  const id = pick?.identifier;
  if (typeof id !== 'string') {
    return { events: [], venue: null };
  }

  const evCall: JamBaseFetchDiag = {};
  const ev = await jamBaseFetch<{ events?: unknown[] }>(
    apiKey,
    '/events',
    {
      venueId: id,
      eventDateFrom: jamBaseVenueEventLookbackDateFrom(),
      expandPastEvents: 'true',
      perPage,
      page,
    },
    jbQ,
    evCall,
  );
  if (diag) mergeJamBaseFetchDiag(diag, evCall);

  const nowMs = Date.now();
  const rawEvents = ev?.events ?? [];
  const events = rawEvents.filter(
    (e): e is Record<string, unknown> =>
      typeof e === 'object' &&
      e !== null &&
      jamBaseEventUpcomingOrInProgress(e as Record<string, unknown>, nowMs),
  );

  return {
    events,
    venue: { name: pick.name, identifier: id },
  };
}

function jamBaseEntityEventsNotice(
  apiKey: string | undefined,
  diag: JamBaseFetchDiag,
  entity: { name: unknown } | null,
  entityLabel: 'artist' | 'venue',
  query: string,
): string | null {
  const upstream = jamBaseUpstreamFailureNotice(apiKey, diag);
  if (upstream) return upstream;
  if (entity) {
    return `No upcoming JamBase dates listed for this ${entityLabel} right now.`;
  }
  return `No JamBase ${entityLabel} match for “${query}”. Check spelling or try the exact billing name.`;
}

export async function getEventsByArtistName(c: Context) {
  const raw = (c.req.query('artistName') || '').trim();
  if (!raw) {
    return c.json({ events: [], artist: null });
  }

  const key = c.env.JAMBASE_API_KEY;

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const perPage = c.req.query('perPage') || '32';
    const page = c.req.query('page') || '1';
    const diag: JamBaseFetchDiag = {};
    const { events, artist } = await fetchJamBaseEventsByArtistName(
      key?.trim() ?? '',
      jbQ,
      raw,
      perPage,
      page,
      diag,
    );

    const notice =
      events.length === 0
        ? jamBaseEntityEventsNotice(key, diag, artist, 'artist', raw)
        : null;

    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 3600 });
    return c.json({
      events,
      artist,
      ...(notice ? { notice } : {}),
    });
  } catch (error) {
    console.error('JamBase events by artist name error:', error);
    return c.json({ error: 'Failed to load shows', events: [], artist: null }, 500);
  }
}

export async function getEventsByVenueName(c: Context) {
  const raw = (c.req.query('venueName') || '').trim();
  if (!raw) {
    return c.json({ events: [], venue: null });
  }

  const key = c.env.JAMBASE_API_KEY;

  try {
    const jbQ = jamBaseQuotaFromEnv(c.env);
    const perPage = c.req.query('perPage') || '32';
    const page = c.req.query('page') || '1';
    const diag: JamBaseFetchDiag = {};
    const { events, venue } = await fetchJamBaseEventsByVenueName(
      key?.trim() ?? '',
      jbQ,
      raw,
      perPage,
      page,
      diag,
    );

    const notice =
      events.length === 0
        ? jamBaseEntityEventsNotice(key, diag, venue, 'venue', raw)
        : null;

    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 3600 });
    return c.json({
      events,
      venue,
      ...(notice ? { notice } : {}),
    });
  } catch (error) {
    console.error('JamBase events by venue name error:', error);
    return c.json({ error: 'Failed to load shows', events: [], venue: null }, 500);
  }
}

// Legacy D1 sync helpers (unused by current worker routes; kept for optional imports)
export async function syncArtistData(db: D1Database, jambaseArtist: any) {
  const { identifier, name, description, image } = jambaseArtist;

  const existing = await db.prepare('SELECT id FROM artists WHERE jambase_id = ?').bind(identifier).first();

  if (existing) {
    await db
      .prepare(
        `UPDATE artists 
       SET name = ?, bio = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE jambase_id = ?`
      )
      .bind(name, description || null, image || null, identifier)
      .run();

    return existing.id;
  } else {
    const result = await db
      .prepare(
        `INSERT INTO artists (name, bio, image_url, jambase_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(name, description || null, image || null, identifier)
      .run();

    return result.meta.last_row_id;
  }
}

export async function syncVenueData(db: D1Database, jambaseVenue: any) {
  const { identifier, name, location, address, capacity } = jambaseVenue;

  const existing = await db.prepare('SELECT id FROM venues WHERE jambase_id = ?').bind(identifier).first();

  if (existing) {
    await db
      .prepare(
        `UPDATE venues 
       SET name = ?, location = ?, address = ?, capacity = ?, updated_at = CURRENT_TIMESTAMP
       WHERE jambase_id = ?`
      )
      .bind(
        name,
        location?.city ? `${location.city}, ${location.state || location.country}` : null,
        address || null,
        capacity || null,
        identifier
      )
      .run();

    return existing.id;
  } else {
    const result = await db
      .prepare(
        `INSERT INTO venues (name, location, address, capacity, jambase_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(
        name,
        location?.city ? `${location.city}, ${location.state || location.country}` : null,
        address || null,
        capacity || null,
        identifier
      )
      .run();

    return result.meta.last_row_id;
  }
}
