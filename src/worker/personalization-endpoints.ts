import { Context } from 'hono';
import { normalizeClipApiRows } from './clip-row-normalize';

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

    // Get user profile with personalization settings
    const profile = await c.env.DB.prepare(
      `SELECT favorite_artists, home_latitude, home_longitude, location_radius_miles, personalization_enabled
       FROM user_profiles 
       WHERE mocha_user_id = ?`
    )
      .bind(mochaUser.id)
      .first();

    if (!profile || !profile.personalization_enabled) {
      return c.json({ concerts: [], personalized: false });
    }

    const favoriteArtists = profile.favorite_artists ? JSON.parse(profile.favorite_artists as string) : [];
    
    if (favoriteArtists.length === 0) {
      return c.json({ concerts: [], personalized: true, message: 'No favorite artists set' });
    }

    // Query upcoming tour dates for favorite artists
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
       WHERE artists.name IN (${favoriteArtists.map(() => '?').join(',')})
       AND artist_tour_dates.date >= datetime('now')
       ORDER BY artist_tour_dates.date ASC
       LIMIT ?`
    )
      .bind(...favoriteArtists, limit)
      .all();

    return c.json({
      concerts: concerts.results || [],
      personalized: true
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
