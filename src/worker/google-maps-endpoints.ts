import { Context } from 'hono';

/**
 * Google Maps API Integration
 * Enhanced geolocation with Places, Geocoding, and Distance Matrix
 */

const GOOGLE_MAPS_API_BASE = 'https://maps.googleapis.com/maps/api';

/**
 * Geocode an address to coordinates
 */
export async function geocodeAddress(c: Context) {
  const address = c.req.query('address');

  if (!address) {
    return c.json({ error: 'Address is required' }, 400);
  }

  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: 'Google Maps API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      address,
      key: c.env.GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/geocode/json?${params}`);
    const data = await response.json() as any;

    if (data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    c.header('Cache-Control', 'public, max-age=86400'); // 24 hours

    return c.json({
      results: data.results,
      location: data.results[0]?.geometry?.location || null,
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return c.json({ error: 'Failed to geocode address' }, 500);
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(c: Context) {
  const lat = c.req.query('lat');
  const lng = c.req.query('lng');

  if (!lat || !lng) {
    return c.json({ error: 'Latitude and longitude are required' }, 400);
  }

  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: 'Google Maps API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: c.env.GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/geocode/json?${params}`);
    const data = await response.json() as any;

    if (data.status !== 'OK') {
      throw new Error(`Reverse geocoding failed: ${data.status}`);
    }

    c.header('Cache-Control', 'public, max-age=3600'); // 1 hour

    return c.json({
      results: data.results,
      formattedAddress: data.results[0]?.formatted_address || null,
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return c.json({ error: 'Failed to reverse geocode' }, 500);
  }
}

/**
 * Search for nearby venues using Places API
 */
export async function searchNearbyVenues(c: Context) {
  const lat = c.req.query('lat');
  const lng = c.req.query('lng');
  const radius = c.req.query('radius') || '5000'; // meters
  const type = c.req.query('type') || 'night_club'; // or 'bar', 'restaurant', etc.

  if (!lat || !lng) {
    return c.json({ error: 'Latitude and longitude are required' }, 400);
  }

  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: 'Google Maps API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius,
      type,
      key: c.env.GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/place/nearbysearch/json?${params}`);
    const data = await response.json() as any;

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places search failed: ${data.status}`);
    }

    c.header('Cache-Control', 'public, max-age=1800'); // 30 minutes

    return c.json({
      venues: data.results || [],
      nextPageToken: data.next_page_token || null,
    });
  } catch (error) {
    console.error('Places search error:', error);
    return c.json({ error: 'Failed to search venues', venues: [] }, 500);
  }
}

/**
 * Get place details by Place ID
 */
export async function getPlaceDetails(c: Context) {
  const placeId = c.req.query('place_id');

  if (!placeId) {
    return c.json({ error: 'Place ID is required' }, 400);
  }

  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: 'Google Maps API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'name,formatted_address,geometry,photos,rating,user_ratings_total,opening_hours,website,formatted_phone_number',
      key: c.env.GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/place/details/json?${params}`);
    const data = await response.json() as any;

    if (data.status !== 'OK') {
      throw new Error(`Place details failed: ${data.status}`);
    }

    c.header('Cache-Control', 'public, max-age=3600'); // 1 hour

    return c.json({
      place: data.result || null,
    });
  } catch (error) {
    console.error('Place details error:', error);
    return c.json({ error: 'Failed to get place details' }, 500);
  }
}

/**
 * Calculate distance between two points
 */
export async function calculateDistance(c: Context) {
  const origins = c.req.query('origins'); // lat,lng
  const destinations = c.req.query('destinations'); // lat,lng

  if (!origins || !destinations) {
    return c.json({ error: 'Origins and destinations are required' }, 400);
  }

  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: 'Google Maps API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      origins,
      destinations,
      key: c.env.GOOGLE_MAPS_API_KEY,
    });

    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/distancematrix/json?${params}`);
    const data = await response.json() as any;

    if (data.status !== 'OK') {
      throw new Error(`Distance calculation failed: ${data.status}`);
    }

    c.header('Cache-Control', 'public, max-age=3600');

    return c.json({
      distance: data.rows[0]?.elements[0] || null,
    });
  } catch (error) {
    console.error('Distance calculation error:', error);
    return c.json({ error: 'Failed to calculate distance' }, 500);
  }
}

/**
 * Autocomplete venue search
 */
export async function autocompleteVenue(c: Context) {
  const input = c.req.query('input');
  const lat = c.req.query('lat');
  const lng = c.req.query('lng');

  if (!input) {
    return c.json({ error: 'Input is required' }, 400);
  }

  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: 'Google Maps API not configured' }, 503);
  }

  try {
    const params = new URLSearchParams({
      input,
      types: 'establishment',
      key: c.env.GOOGLE_MAPS_API_KEY,
    });

    if (lat && lng) {
      params.append('location', `${lat},${lng}`);
      params.append('radius', '50000'); // 50km
    }

    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/place/autocomplete/json?${params}`);
    const data = await response.json() as any;

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Autocomplete failed: ${data.status}`);
    }

    c.header('Cache-Control', 'public, max-age=300'); // 5 minutes

    return c.json({
      predictions: data.predictions || [],
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return c.json({ error: 'Failed to autocomplete', predictions: [] }, 500);
  }
}
