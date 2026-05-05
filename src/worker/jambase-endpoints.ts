import { Context } from 'hono';
import { jamBaseFetch, jamBaseEventDateFromToday } from './jambase-client';
import { buildTightJamBaseEventResults } from './jambase-events-search';
import {
  normalizedSlugFromRouteParam,
  searchPhraseFromSlug,
  slugifyEntityName,
} from '../shared/jambase-slug';

/**
 * JamBase Data API v3 — proxy endpoints for the SPA.
 * @see https://data.jambase.com/api/docs/getting-started
 */

export async function searchArtists(c: Context) {
  const query = c.req.query('q') || '';
  const perPage = c.req.query('limit') || c.req.query('perPage') || '20';

  if (!query || query.length < 2) {
    return c.json({ artists: [] });
  }

  try {
    const data = await jamBaseFetch<{ artists?: unknown[] }>(
      c.env.JAMBASE_API_KEY,
      '/artists',
      {
        artistName: query,
        page: c.req.query('page') || '1',
        perPage,
      }
    );

    c.header('Cache-Control', 'public, max-age=3600');

    return c.json({
      artists: data?.artists || [],
      pagination: {},
    });
  } catch (error) {
    console.error('JamBase artist search error:', error);
    return c.json({ error: 'Failed to search artists', artists: [] }, 500);
  }
}

export async function searchVenues(c: Context) {
  const query = c.req.query('q') || '';
  const perPage = c.req.query('limit') || c.req.query('perPage') || '20';

  if (!query && !c.req.query('location')) {
    return c.json({ venues: [] });
  }

  try {
    const params: Record<string, string> = {
      page: c.req.query('page') || '1',
      perPage,
    };
    if (query) params.venueName = query;

    const data = await jamBaseFetch<{ venues?: unknown[] }>(
      c.env.JAMBASE_API_KEY,
      '/venues',
      params
    );

    c.header('Cache-Control', 'public, max-age=3600');

    return c.json({
      venues: data?.venues || [],
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
    const data = await jamBaseFetch<{ events?: unknown[] }>(c.env.JAMBASE_API_KEY, '/events', {
      artistId,
      eventDateFrom: jamBaseEventDateFromToday(),
      page: c.req.query('page') || '1',
      perPage,
    });

    c.header('Cache-Control', 'public, max-age=1800');

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
  c.header('Cache-Control', 'public, max-age=300');
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

    const data = await jamBaseFetch<{ events?: unknown[] }>(c.env.JAMBASE_API_KEY, '/events', params);

    c.header('Cache-Control', 'public, max-age=600');

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
    const data = await jamBaseFetch<Record<string, unknown>>(
      c.env.JAMBASE_API_KEY,
      `/artists/${artistId}`,
      {}
    );

    if (!data) {
      return c.json({ error: 'Artist not found or unavailable for this key' }, 404);
    }

    c.header('Cache-Control', 'public, max-age=7200');

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
    const data = await jamBaseFetch<Record<string, unknown>>(
      c.env.JAMBASE_API_KEY,
      `/venues/${venueId}`,
      {}
    );

    if (!data) {
      return c.json({ error: 'Venue not found or unavailable for this key' }, 404);
    }

    c.header('Cache-Control', 'public, max-age=7200');

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
    return c.json({ events: [] });
  }

  try {
    const key = c.env.JAMBASE_API_KEY;
    if (!key?.trim()) {
      return c.json({ events: [] });
    }

    if (c.req.query('loose') === '1') {
      const data = await jamBaseFetch<{ events?: unknown[] }>(key, '/events', {
        artistName: q,
        eventDateFrom: c.req.query('eventDateFrom') || jamBaseEventDateFromToday(),
        page: c.req.query('page') || '1',
        perPage: String(max),
      });
      c.header('Cache-Control', 'public, max-age=600');
      return c.json({ events: data?.events || [] });
    }

    const events = await buildTightJamBaseEventResults(key, q, max);
    c.header('Cache-Control', 'public, max-age=600');
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
        }
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

    const data = await jamBaseFetch<{ events?: unknown[] }>(key, '/events', params);
    c.header('Cache-Control', 'public, max-age=600');
    return c.json({
      events: data?.events ?? [],
      meta: { geoMetroId: params.geoMetroId, geoCityId: params.geoCityId, artistName: params.artistName },
    });
  } catch (error) {
    console.error('JamBase live-tab error:', error);
    return c.json({ error: 'Failed to load events', events: [] }, 500);
  }
}

export async function getEventsByArtistName(c: Context) {
  const raw = (c.req.query('artistName') || '').trim();
  if (!raw) {
    return c.json({ events: [], artist: null });
  }

  const key = c.env.JAMBASE_API_KEY;
  if (!key?.trim()) {
    return c.json({ events: [], artist: null });
  }

  try {
    const slug = slugifyEntityName(raw) || normalizedSlugFromRouteParam(raw);
    const phrase = searchPhraseFromSlug(slug);

    const list = await jamBaseFetch<{ artists?: Record<string, unknown>[] }>(key, '/artists', {
      artistName: phrase,
      perPage: '8',
      page: '1',
    });
    const artists = list?.artists ?? [];
    if (!artists.length) {
      return c.json({ events: [], artist: null });
    }

    const exact = artists.find((a) => slugifyEntityName(String(a.name)) === slug);
    const pick = exact || artists[0];
    const id = pick?.identifier;
    if (typeof id !== 'string') {
      return c.json({ events: [], artist: null });
    }

    const ev = await jamBaseFetch<{ events?: unknown[] }>(key, '/events', {
      artistId: id,
      eventDateFrom: jamBaseEventDateFromToday(),
      perPage: c.req.query('perPage') || '32',
      page: c.req.query('page') || '1',
    });

    c.header('Cache-Control', 'public, max-age=600');

    return c.json({
      events: ev?.events ?? [],
      artist: { name: pick.name, identifier: pick.identifier },
    });
  } catch (error) {
    console.error('JamBase events by artist name error:', error);
    return c.json({ error: 'Failed to load shows', events: [], artist: null }, 500);
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
