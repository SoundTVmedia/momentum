import { Context } from 'hono';
import { normalizeClipApiRows } from './clip-row-normalize';
import { jamBaseQuotaFromEnv } from './jambase-client';
import { fetchJamBaseEventsByArtistName } from './jambase-endpoints';
import { dedupeJamBaseEvents } from './jambase-events-search';

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** JamBase / schema.org-style event.place coordinates when present. */
function jamBaseEventCoords(ev: Record<string, unknown>): { lat: number; lon: number } | null {
  const loc = ev.location;
  if (!loc || typeof loc !== 'object') return null;
  const l = loc as Record<string, unknown>;
  const pair = (latRaw: unknown, lonRaw: unknown) => {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  };
  const direct = pair(l.latitude, l.longitude);
  if (direct) return direct;
  const geo = l.geo;
  if (geo && typeof geo === 'object') {
    const g = geo as Record<string, unknown>;
    return pair(g.latitude, g.longitude) ?? pair(g.lat, g.lng);
  }
  return null;
}

/**
 * Update user personalization settings
 * Stores favorite artists and home location for feed customization
 */
export async function updatePersonalization(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { 
      favorite_artists, 
      home_location, 
      home_latitude, 
      home_longitude, 
      location_radius_miles,
      personalization_enabled 
    } = body;

    // Update user profile with personalization settings
    await c.env.DB.prepare(
      `UPDATE user_profiles 
       SET favorite_artists = ?,
           home_location = ?,
           home_latitude = ?,
           home_longitude = ?,
           location_radius_miles = ?,
           personalization_enabled = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE mocha_user_id = ?`
    )
      .bind(
        favorite_artists ? JSON.stringify(favorite_artists) : null,
        home_location || null,
        home_latitude || null,
        home_longitude || null,
        location_radius_miles || 50,
        personalization_enabled !== undefined ? (personalization_enabled ? 1 : 0) : 1,
        mochaUser.id
      )
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Update personalization error:', error);
    return c.json({ error: 'Failed to update personalization settings' }, 500);
  }
}

/**
 * Get personalized feed for user
 * Returns clips and concerts based on favorite artists and location
 */
export async function getPersonalizedFeed(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    // Get user profile with personalization settings
    const profile = await c.env.DB.prepare(
      `SELECT favorite_artists, home_latitude, home_longitude, location_radius_miles, personalization_enabled
       FROM user_profiles 
       WHERE mocha_user_id = ?`
    )
      .bind(mochaUser.id)
      .first();

    if (!profile || !profile.personalization_enabled) {
      // Return regular feed if personalization is disabled
      return c.json({ clips: [], personalized: false });
    }

    const favoriteArtists = profile.favorite_artists ? JSON.parse(profile.favorite_artists as string) : [];
    const hasLocation = profile.home_latitude && profile.home_longitude;
    const radiusMiles = profile.location_radius_miles || 50;

    // Build personalized query
    let query = `
      SELECT 
        clips.rowid AS _clipRowId,
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar,
        CASE 
          WHEN clips.artist_name IN (${favoriteArtists.map(() => '?').join(',')}) THEN 10
          ELSE 0
        END as artist_score,
        CASE
          WHEN clips.created_at >= datetime('now', '-24 hours') THEN 3
          ELSE 0
        END as recency_score
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.is_hidden = 0 AND clips.is_draft = 0
      AND clips.mocha_user_id != ?
    `;

    const bindings: any[] = [...favoriteArtists];

    // Add location-based scoring if user has set home location
    if (hasLocation) {
      // Haversine formula for distance calculation (approximate)
      // This is a simplified version - for production, use PostGIS or similar
      const lat = profile.home_latitude as number;
      const lon = profile.home_longitude as number;
      
      query = `
        SELECT 
          clips.rowid AS _clipRowId,
          clips.*,
          user_profiles.display_name as user_display_name,
          user_profiles.profile_image_url as user_avatar,
          CASE 
            WHEN clips.artist_name IN (${favoriteArtists.map(() => '?').join(',')}) THEN 10
            ELSE 0
          END as artist_score,
          CASE
            WHEN clips.geolocation_latitude IS NOT NULL AND clips.geolocation_longitude IS NOT NULL THEN
              CASE
                WHEN (
                  3959 * acos(
                    cos(radians(?)) * cos(radians(clips.geolocation_latitude)) * 
                    cos(radians(clips.geolocation_longitude) - radians(?)) + 
                    sin(radians(?)) * sin(radians(clips.geolocation_latitude))
                  )
                ) <= ? THEN 5
                ELSE 0
              END
            ELSE 0
          END as location_score,
          CASE
            WHEN clips.created_at >= datetime('now', '-24 hours') THEN 3
            ELSE 0
          END as recency_score
        FROM clips
        LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
        WHERE clips.is_hidden = 0 AND clips.is_draft = 0
        AND clips.mocha_user_id != ?
      `;
      
      bindings.push(lat, lon, lat, radiusMiles);
    }

    // Exclude viewer's own uploads from "For You"
    bindings.push(mochaUser.id);

    // Order by total score
    query += `
      ORDER BY (artist_score + ${hasLocation ? 'location_score +' : ''} recency_score) DESC, 
               clips.created_at DESC
      LIMIT ? OFFSET ?
    `;

    bindings.push(limit, offset);

    const clips = await c.env.DB.prepare(query).bind(...bindings).all();

    return c.json({
      clips: normalizeClipApiRows((clips.results || []) as Record<string, unknown>[]),
      personalized: true,
      page,
      limit,
      hasMore: (clips.results || []).length === limit
    });
  } catch (error) {
    console.error('Get personalized feed error:', error);
    return c.json({ error: 'Failed to get personalized feed' }, 500);
  }
}

/**
 * Get personalized concert recommendations
 * Returns upcoming concerts from favorite artists and near user's location
 */
export async function getPersonalizedConcerts(c: Context) {
  const mochaUser = c.get("user");

  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

    const profile = await c.env.DB.prepare(
      `SELECT favorite_artists, home_latitude, home_longitude, location_radius_miles, personalization_enabled
       FROM user_profiles 
       WHERE mocha_user_id = ?`
    )
      .bind(mochaUser.id)
      .first();

    if (!profile || !profile.personalization_enabled) {
      return c.json({ concerts: [], events: [], personalized: false });
    }

    let favoriteArtists: string[] = [];
    try {
      const raw = profile.favorite_artists as string | null;
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          favoriteArtists = parsed
            .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
            .filter(Boolean);
        }
      }
    } catch {
      favoriteArtists = [];
    }

    if (favoriteArtists.length === 0) {
      return c.json({
        concerts: [],
        events: [],
        personalized: true,
        message: 'No favorite artists set',
      });
    }

    const uniqueArtists = [...new Set(favoriteArtists)].slice(0, 8);
    const key = c.env.JAMBASE_API_KEY;

    if (key?.trim()) {
      const jbQ = jamBaseQuotaFromEnv(c.env);
      const perArtistCap = Math.min(
        20,
        Math.max(6, Math.ceil((limit * 3) / Math.max(1, uniqueArtists.length)))
      );
      const allRaw: Record<string, unknown>[] = [];

      await Promise.all(
        uniqueArtists.map(async (artistName) => {
          try {
            const { events } = await fetchJamBaseEventsByArtistName(
              key,
              jbQ,
              artistName,
              String(perArtistCap),
              '1'
            );
            allRaw.push(...events);
          } catch (e) {
            console.error('Personalized JamBase fetch failed for', artistName, e);
          }
        })
      );

      const merged = dedupeJamBaseEvents(allRaw);
      merged.sort((a, b) => {
        const sa = typeof a.startDate === 'string' ? new Date(a.startDate).getTime() : 0;
        const sb = typeof b.startDate === 'string' ? new Date(b.startDate).getTime() : 0;
        return sa - sb;
      });

      const homeLat = profile.home_latitude != null ? Number(profile.home_latitude) : NaN;
      const homeLon = profile.home_longitude != null ? Number(profile.home_longitude) : NaN;
      const radiusMiles = Math.max(1, Number(profile.location_radius_miles) || 50);
      const hasHome = Number.isFinite(homeLat) && Number.isFinite(homeLon);

      type RadiusMeta =
        | { applied: false }
        | {
            applied: true;
            radius_miles: number;
            mode: 'in_radius' | 'no_coordinates_fallback' | 'no_matches_in_radius';
          };

      let radiusMeta: RadiusMeta = { applied: false };
      let pool = merged;

      if (hasHome) {
        const inRadius: Record<string, unknown>[] = [];
        const noGeo: Record<string, unknown>[] = [];
        for (const ev of merged) {
          const c = jamBaseEventCoords(ev);
          if (!c) {
            noGeo.push(ev);
            continue;
          }
          const d = haversineMiles(homeLat, homeLon, c.lat, c.lon);
          if (d <= radiusMiles) inRadius.push(ev);
        }

        if (inRadius.length > 0) {
          pool = inRadius;
          radiusMeta = { applied: true, radius_miles: radiusMiles, mode: 'in_radius' };
        } else if (noGeo.length > 0) {
          pool = noGeo;
          radiusMeta = {
            applied: true,
            radius_miles: radiusMiles,
            mode: 'no_coordinates_fallback',
          };
        } else if (merged.length > 0) {
          pool = [];
          radiusMeta = {
            applied: true,
            radius_miles: radiusMiles,
            mode: 'no_matches_in_radius',
          };
        } else {
          pool = merged;
          radiusMeta = { applied: false };
        }
      }

      const slice = pool.slice(0, limit);

      if (slice.length > 0) {
        return c.json({
          events: slice,
          concerts: [],
          personalized: true,
          source: 'jambase' as const,
          radius_meta: radiusMeta,
        });
      }

      if (hasHome && radiusMeta.applied && radiusMeta.mode === 'no_matches_in_radius') {
        return c.json({
          events: [],
          concerts: [],
          personalized: true,
          source: 'jambase' as const,
          message:
            'No upcoming shows from your favorites within your search radius. Try widening it in personalization settings.',
          radius_meta: radiusMeta,
        });
      }
    }

    const concerts = await c.env.DB.prepare(
      `SELECT 
        artist_tour_dates.*,
        artists.name as artist_name,
        artists.image_url as artist_image,
        venues.name as venue_name,
        venues.location as venue_location
       FROM artist_tour_dates
       LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
       LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
       WHERE artists.name IN (${uniqueArtists.map(() => '?').join(',')})
       AND artist_tour_dates.date >= datetime('now')
       ORDER BY artist_tour_dates.date ASC
       LIMIT ?`
    )
      .bind(...uniqueArtists, limit)
      .all();

    return c.json({
      concerts: concerts.results || [],
      events: [],
      personalized: true,
      source: 'd1' as const,
    });
  } catch (error) {
    console.error('Get personalized concerts error:', error);
    return c.json({ error: 'Failed to get personalized concerts' }, 500);
  }
}

/**
 * Trigger personalization notifications
 * Called when new concerts/clips are added that match user preferences
 */
export async function triggerPersonalizationNotifications(
  env: any,
  clipOrConcert: {
    id: number;
    artist_name?: string;
    venue_name?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    type: 'clip' | 'concert';
  }
) {
  try {
    // Find users who have this artist in their favorites
    let usersToNotify: any[] = [];
    
    if (clipOrConcert.artist_name) {
      const users = await env.DB.prepare(
        `SELECT mocha_user_id, favorite_artists 
         FROM user_profiles 
         WHERE personalization_enabled = 1
         AND favorite_artists IS NOT NULL`
      ).all();

      usersToNotify = (users.results || []).filter((user: any) => {
        try {
          const favorites = JSON.parse(user.favorite_artists);
          return favorites.includes(clipOrConcert.artist_name);
        } catch {
          return false;
        }
      });
    }

    // Create notifications for matching users
    for (const user of usersToNotify) {
      const content = `${clipOrConcert.artist_name} ${clipOrConcert.type === 'clip' ? 'posted a new moment' : 'announced a show'}${clipOrConcert.venue_name ? ` at ${clipOrConcert.venue_name}` : ''}`;
      
      await env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
         VALUES (?, 'favorite_artist', ?, ?, CURRENT_TIMESTAMP)`
      )
        .bind(
          user.mocha_user_id,
          content,
          clipOrConcert.type === 'clip' ? clipOrConcert.id : null
        )
        .run();
    }

    // TODO: Send push notifications and email notifications
    // This would require integrating with a notification service like Firebase Cloud Messaging
    // or a transactional email service like SendGrid

  } catch (error) {
    console.error('Trigger personalization notifications error:', error);
  }
}
