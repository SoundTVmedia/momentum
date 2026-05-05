import { Context } from 'hono';

const JAMBASE_API_BASE = 'https://www.jambase.com/jb-api/v1';

/**
 * JamBase API Integration Endpoints
 * Provides proxy access to JamBase API for artist, venue, and event data
 */

// Helper function to make JamBase API requests
async function fetchJamBase(endpoint: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${JAMBASE_API_BASE}${endpoint}`);
  url.searchParams.append('apikey', apiKey);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`JamBase API error: ${response.status}`);
  }

  return response.json();
}

// Search for artists by name
export async function searchArtists(c: Context) {
  const query = c.req.query('q') || '';
  const limit = c.req.query('limit') || '20';

  if (!query || query.length < 2) {
    return c.json({ artists: [] });
  }

  try {
    const data = await fetchJamBase('/artists', c.env.JAMBASE_API_KEY, {
      name: query,
      page: '0',
      limit,
    }) as any;

    // Cache results for 1 hour
    c.header('Cache-Control', 'public, max-age=3600');

    return c.json({ 
      artists: data.artists || [],
      pagination: data.pagination || {},
    });
  } catch (error) {
    console.error('JamBase artist search error:', error);
    return c.json({ error: 'Failed to search artists', artists: [] }, 500);
  }
}

// Search for venues by name or location
export async function searchVenues(c: Context) {
  const query = c.req.query('q') || '';
  const location = c.req.query('location') || '';
  const limit = c.req.query('limit') || '20';

  if (!query && !location) {
    return c.json({ venues: [] });
  }

  try {
    const params: Record<string, string> = {
      page: '0',
      limit,
    };

    if (query) params.name = query;
    if (location) params.geoLocation = location;

    const data = await fetchJamBase('/venues', c.env.JAMBASE_API_KEY, params) as any;

    c.header('Cache-Control', 'public, max-age=3600');

    return c.json({ 
      venues: data.venues || [],
      pagination: data.pagination || {},
    });
  } catch (error) {
    console.error('JamBase venue search error:', error);
    return c.json({ error: 'Failed to search venues', venues: [] }, 500);
  }
}

// Get artist details and tour dates
export async function getArtistTourDates(c: Context) {
  const artistId = c.req.param('artistId');
  const limit = c.req.query('limit') || '50';

  if (!artistId) {
    return c.json({ error: 'artistId is required', events: [] }, 400);
  }

  try {
    const data = await fetchJamBase('/events', c.env.JAMBASE_API_KEY, {
      artistId,
      page: '0',
      limit,
      startDate: new Date().toISOString().split('T')[0], // Today onwards
    }) as any;

    c.header('Cache-Control', 'public, max-age=1800'); // 30 minutes

    return c.json({ 
      events: data.events || [],
      pagination: data.pagination || {},
    });
  } catch (error) {
    console.error('JamBase tour dates error:', error);
    return c.json({ error: 'Failed to fetch tour dates', events: [] }, 500);
  }
}

// Match events by location and timestamp (for auto-tagging)
export async function matchEventsByLocation(c: Context) {
  const lat = c.req.query('lat');
  const lon = c.req.query('lon');
  const timestamp = c.req.query('timestamp');
  const radius = c.req.query('radius') || '10'; // 10 miles default

  if (!lat || !lon || !timestamp) {
    return c.json({ error: 'lat, lon, and timestamp are required' }, 400);
  }

  try {
    const eventDate = new Date(timestamp);
    const startDate = new Date(eventDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(eventDate);
    endDate.setHours(23, 59, 59, 999);

    const data = await fetchJamBase('/events', c.env.JAMBASE_API_KEY, {
      geoLocation: `${lat},${lon}`,
      radius,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      page: '0',
      limit: '20',
    }) as any;

    c.header('Cache-Control', 'public, max-age=300'); // 5 minutes

    return c.json({ 
      events: data.events || [],
      matchCount: (data.events || []).length,
    });
  } catch (error) {
    console.error('JamBase event matching error:', error);
    return c.json({ error: 'Failed to match events', events: [] }, 500);
  }
}

// Get upcoming events (for Discover page)
export async function getUpcomingEvents(c: Context) {
  const location = c.req.query('location') || '';
  const genre = c.req.query('genre') || '';
  const limit = c.req.query('limit') || '30';
  const page = c.req.query('page') || '0';

  try {
    const params: Record<string, string> = {
      page,
      limit,
      startDate: new Date().toISOString().split('T')[0],
    };

    if (location) params.geoLocation = location;
    if (genre) params.genre = genre;

    const data = await fetchJamBase('/events', c.env.JAMBASE_API_KEY, params) as any;

    c.header('Cache-Control', 'public, max-age=600'); // 10 minutes

    return c.json({ 
      events: data.events || [],
      pagination: data.pagination || {},
    });
  } catch (error) {
    console.error('JamBase upcoming events error:', error);
    return c.json({ error: 'Failed to fetch upcoming events', events: [] }, 500);
  }
}

// Get artist details by ID
export async function getArtistById(c: Context) {
  const artistId = c.req.param('artistId');

  try {
    const data = await fetchJamBase(`/artists/${artistId}`, c.env.JAMBASE_API_KEY) as any;

    c.header('Cache-Control', 'public, max-age=7200'); // 2 hours

    return c.json(data);
  } catch (error) {
    console.error('JamBase artist details error:', error);
    return c.json({ error: 'Failed to fetch artist details' }, 500);
  }
}

// Get venue details by ID
export async function getVenueById(c: Context) {
  const venueId = c.req.param('venueId');

  try {
    const data = await fetchJamBase(`/venues/${venueId}`, c.env.JAMBASE_API_KEY) as any;

    c.header('Cache-Control', 'public, max-age=7200'); // 2 hours

    return c.json(data);
  } catch (error) {
    console.error('JamBase venue details error:', error);
    return c.json({ error: 'Failed to fetch venue details' }, 500);
  }
}

// Sync artist data from JamBase to local database
export async function syncArtistData(db: D1Database, jambaseArtist: any) {
  const { identifier, name, description, image } = jambaseArtist;

  // Check if artist exists with this JamBase ID
  const existing = await db.prepare(
    'SELECT id FROM artists WHERE jambase_id = ?'
  ).bind(identifier).first();

  if (existing) {
    // Update existing artist
    await db.prepare(
      `UPDATE artists 
       SET name = ?, bio = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE jambase_id = ?`
    ).bind(name, description || null, image || null, identifier).run();
    
    return existing.id;
  } else {
    // Create new artist
    const result = await db.prepare(
      `INSERT INTO artists (name, bio, image_url, jambase_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(name, description || null, image || null, identifier).run();

    return result.meta.last_row_id;
  }
}

// Sync venue data from JamBase to local database
export async function syncVenueData(db: D1Database, jambaseVenue: any) {
  const { identifier, name, location, address, capacity } = jambaseVenue;

  // Check if venue exists with this JamBase ID
  const existing = await db.prepare(
    'SELECT id FROM venues WHERE jambase_id = ?'
  ).bind(identifier).first();

  if (existing) {
    // Update existing venue
    await db.prepare(
      `UPDATE venues 
       SET name = ?, location = ?, address = ?, capacity = ?, updated_at = CURRENT_TIMESTAMP
       WHERE jambase_id = ?`
    ).bind(
      name,
      location?.city ? `${location.city}, ${location.state || location.country}` : null,
      address || null,
      capacity || null,
      identifier
    ).run();
    
    return existing.id;
  } else {
    // Create new venue
    const result = await db.prepare(
      `INSERT INTO venues (name, location, address, capacity, jambase_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      name,
      location?.city ? `${location.city}, ${location.state || location.country}` : null,
      address || null,
      capacity || null,
      identifier
    ).run();

    return result.meta.last_row_id;
  }
}
