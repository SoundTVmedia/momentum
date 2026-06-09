import { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';
import { notifyFollowers } from './notification-utils';

/**
 * Ticketmaster API Integration
 * Enhanced ticketing with more venues and events
 */

const TICKETMASTER_API_BASE = 'https://app.ticketmaster.com/discovery/v2';

/**
 * Search events on Ticketmaster
 */
export async function searchEvents(c: Context) {
  const query = c.req.query('q') || '';
  const city = c.req.query('city') || '';
  const stateCode = c.req.query('state') || '';
  const startDate = c.req.query('startDate') || '';
  const endDate = c.req.query('endDate') || '';
  const genre = c.req.query('genre') || '';
  const page = c.req.query('page') || '0';
  const lat = c.req.query('lat') || '';
  const lon = c.req.query('lon') || '';
  const radius = c.req.query('radius') || '150';

  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: 'Ticketmaster API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      apikey: c.env.TICKETMASTER_API_KEY,
      page,
      size: '20',
    });

    if (query) params.append('keyword', query);
    if (city) params.append('city', city);
    if (stateCode) params.append('stateCode', stateCode);
    if (startDate) params.append('startDateTime', startDate);
    if (endDate) params.append('endDateTime', endDate);
    if (genre) params.append('classificationName', genre);
    if (lat && lon) {
      params.append('geoPoint', `${lat},${lon}`);
      params.append('radius', radius);
      params.append('unit', 'miles');
      params.append('sort', 'distance,asc');
    }

    const response = await fetch(`${TICKETMASTER_API_BASE}/events.json?${params}`);
    
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }

    const data = await response.json() as any;

    // Cache for 10 minutes
    c.header('Cache-Control', 'public, max-age=600');

    return c.json({
      events: data._embedded?.events || [],
      page: data.page || {},
    });
  } catch (error) {
    console.error('Ticketmaster search error:', error);
    return c.json({ error: 'Failed to search events', events: [] }, 500);
  }
}

/**
 * Get event details by ID
 */
export async function getEventById(c: Context) {
  const eventId = c.req.param('eventId');

  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: 'Ticketmaster API not configured' }, 503);
  }

  try {
    const response = await fetch(
      `${TICKETMASTER_API_BASE}/events/${eventId}.json?apikey=${c.env.TICKETMASTER_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }

    const event = await response.json() as any;

    c.header('Cache-Control', 'public, max-age=1800'); // 30 minutes

    return c.json(event);
  } catch (error) {
    console.error('Ticketmaster event details error:', error);
    return c.json({ error: 'Failed to fetch event details' }, 500);
  }
}

/**
 * Get venue details by ID
 */
export async function getVenueById(c: Context) {
  const venueId = c.req.param('venueId');

  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: 'Ticketmaster API not configured' }, 503);
  }

  try {
    const response = await fetch(
      `${TICKETMASTER_API_BASE}/venues/${venueId}.json?apikey=${c.env.TICKETMASTER_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }

    const venue = await response.json() as any;

    c.header('Cache-Control', 'public, max-age=3600'); // 1 hour

    return c.json(venue);
  } catch (error) {
    console.error('Ticketmaster venue details error:', error);
    return c.json({ error: 'Failed to fetch venue details' }, 500);
  }
}

/**
 * Get artist attractions
 */
export async function searchAttractions(c: Context) {
  const query = c.req.query('q') || '';
  const page = c.req.query('page') || '0';

  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: 'Ticketmaster API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      apikey: c.env.TICKETMASTER_API_KEY,
      keyword: query,
      page,
      size: '20',
    });

    const response = await fetch(`${TICKETMASTER_API_BASE}/attractions.json?${params}`);
    
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }

    const data = await response.json() as any;

    c.header('Cache-Control', 'public, max-age=1800');

    return c.json({
      attractions: data._embedded?.attractions || [],
      page: data.page || {},
    });
  } catch (error) {
    console.error('Ticketmaster attractions search error:', error);
    return c.json({ error: 'Failed to search attractions', attractions: [] }, 500);
  }
}

/**
 * Create affiliate ticket purchase
 */
export async function createTicketPurchase(c: Context) {
  const mochaUser = c.get('user');
  
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { 
    event_id,
    event_name, 
    event_date,
    venue_name,
    ticket_url,
    ticket_price,
    quantity,
    referrer_user_id,
    related_clip_id,
  } = body;

  if (!event_id || !ticket_url) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const uid = mochaUserIdKey(mochaUser);
  const qty = Number(quantity);
  const resolvedQty = Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) : 1;
  const priceRaw = ticket_price != null ? Number(ticket_price) : 0;
  const resolvedPrice = Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.trunc(priceRaw) : 0;

  let relatedClipId: number | null = null;
  if (related_clip_id != null) {
    const n = Number(related_clip_id);
    if (Number.isFinite(n) && n > 0) relatedClipId = Math.trunc(n);
  }

  try {
    const priorClick = await c.env.DB.prepare(
      `SELECT id FROM affiliate_ticket_clicks
       WHERE mocha_user_id = ? AND event_id = ?
         AND created_at >= datetime('now', '-6 hours')
       LIMIT 1`,
    )
      .bind(uid, String(event_id))
      .first();

    const shouldNotifyFollowers = !priorClick;

    // Create affiliate tracking record
    await c.env.DB.prepare(
      `INSERT INTO affiliate_ticket_clicks 
       (mocha_user_id, referrer_user_id, event_id, event_name, event_date, venue_name,
        ticket_url, estimated_price, quantity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      uid,
      referrer_user_id || null,
      String(event_id),
      event_name || null,
      event_date || null,
      venue_name || null,
      ticket_url,
      resolvedPrice,
      resolvedQty,
    ).run();

    if (shouldNotifyFollowers) {
      const showLabel =
        typeof event_name === 'string' && event_name.trim()
          ? event_name.trim()
          : typeof venue_name === 'string' && venue_name.trim()
            ? venue_name.trim()
            : 'a show';

      try {
        await notifyFollowers(c.env, mochaUser, {
          type: 'ticket_interest',
          content: `looked at tickets for ${showLabel}`,
          related_clip_id: relatedClipId,
        });
      } catch (err) {
        console.error('ticket_interest notifyFollowers:', err);
      }
    }

    // Award points for ticket discovery
    if (referrer_user_id) {
      const { awardPoints } = await import('./gamification-endpoints');
      await awardPoints(c.env, referrer_user_id, 5, 'Referred ticket purchase');
    }

    return c.json({ 
      success: true,
      redirectUrl: ticket_url,
      notified_followers: shouldNotifyFollowers,
    });
  } catch (error) {
    console.error('Ticket purchase tracking error:', error);
    return c.json({ error: 'Failed to track purchase' }, 500);
  }
}
