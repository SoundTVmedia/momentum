import { Context } from 'hono';
import { resolveArtistNameForClipsQuery } from './artist-venue-pages';

/**
 * Get prioritized shows for discovery feed
 * Priority:
 * 1. Live shows with trending clips
 * 2. Upcoming shows within 60 miles (if location provided)
 * 3. Favorite artists with upcoming shows
 * 4. Favorite artists (general)
 * 5. General trending content
 */
export async function getPrioritizedShows(c: Context) {
  const userId = c.req.query('user_id');
  const latitude = c.req.query('latitude');
  const longitude = c.req.query('longitude');
  const radiusMiles = parseFloat(c.req.query('radius_miles') || '60');

  try {
    const prioritizedShows: any[] = [];

    // Get user's favorite artists if authenticated
    let favoriteArtistIds: number[] = [];
    let favoriteArtistNames: string[] = [];
    if (userId) {
      const favorites = await c.env.DB.prepare(
        `SELECT 
          user_favorite_artists.artist_id,
          artists.name
        FROM user_favorite_artists
        LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
        WHERE user_favorite_artists.mocha_user_id = ?`
      )
        .bind(userId)
        .all();
      favoriteArtistIds = (favorites.results || []).map((f: any) => f.artist_id);
      favoriteArtistNames = (favorites.results || []).map((f: any) => f.name).filter(Boolean);
    }

    // 1. Get currently live sessions with trending clips
    const liveSessions = await c.env.DB.prepare(
      `SELECT 
        live_sessions.id as session_id,
        live_sessions.title,
        live_sessions.start_time,
        clips.artist_name,
        clips.venue_name,
        clips.location,
        venues.id as venue_id,
        venues.image_url as venue_image,
        artists.image_url as artist_image,
        COUNT(DISTINCT clips.id) as moments_count,
        SUM(clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as trending_score
      FROM live_sessions
      LEFT JOIN live_session_clips ON live_sessions.id = live_session_clips.live_session_id
      LEFT JOIN clips ON live_session_clips.clip_id = clips.id
      LEFT JOIN venues ON clips.venue_name = venues.name
      LEFT JOIN artists ON clips.artist_name = artists.name
      WHERE live_sessions.status = 'live'
      AND clips.created_at >= datetime('now', '-2 hours')
      GROUP BY live_sessions.id, clips.artist_name, clips.venue_name
      HAVING moments_count > 0
      ORDER BY trending_score DESC`
    ).all();

    for (const session of (liveSessions.results || [])) {
      const isFavorite = favoriteArtistNames.includes((session as any).artist_name);
      
      prioritizedShows.push({
        type: 'live',
        priority: 1,
        session_id: (session as any).session_id,
        artist_name: (session as any).artist_name,
        artist_image: (session as any).artist_image,
        venue_name: (session as any).venue_name,
        location: (session as any).location,
        moments_count: (session as any).moments_count,
        is_live: true,
        is_favorite: isFavorite,
        start_time: (session as any).start_time
      });
    }

    // 2. Get nearby upcoming shows (if location provided)
    if (latitude && longitude && c.env.GOOGLE_MAPS_API_KEY) {
      try {
        // Get all upcoming shows from next 30 days
        const upcomingShows = await c.env.DB.prepare(
          `SELECT 
            artist_tour_dates.*,
            artists.name as artist_name,
            artists.image_url as artist_image,
            venues.name as venue_name,
            venues.location as venue_location,
            venues.address as venue_address
          FROM artist_tour_dates
          LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
          LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
          WHERE artist_tour_dates.date >= datetime('now')
          AND artist_tour_dates.date <= datetime('now', '+30 days')
          AND venues.address IS NOT NULL`
        ).all();

        // Calculate distances for each show
        for (const show of (upcomingShows.results || [])) {
          try {
            // Geocode venue address to get coordinates
            const geocodeResponse = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent((show as any).venue_address)}&key=${c.env.GOOGLE_MAPS_API_KEY}`
            );
            
            if (geocodeResponse.ok) {
              const geocodeData = await geocodeResponse.json() as any;
              
              if (geocodeData.results && geocodeData.results.length > 0) {
                const venueLat = geocodeData.results[0].geometry.location.lat;
                const venueLng = geocodeData.results[0].geometry.location.lng;
                
                // Calculate distance using Haversine formula
                const R = 3959; // Earth's radius in miles
                const dLat = (venueLat - parseFloat(latitude)) * Math.PI / 180;
                const dLon = (venueLng - parseFloat(longitude)) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(parseFloat(latitude) * Math.PI / 180) * Math.cos(venueLat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c;
                
                // Only include shows within radius
                if (distance <= radiusMiles) {
                  const isFavorite = favoriteArtistIds.includes((show as any).artist_id);
                  
                  prioritizedShows.push({
                    type: 'nearby_upcoming',
                    priority: isFavorite ? 2 : 2.5,
                    artist_name: (show as any).artist_name,
                    artist_image: (show as any).artist_image,
                    venue_name: (show as any).venue_name,
                    venue_location: (show as any).venue_location,
                    date: (show as any).date,
                    ticket_url: (show as any).ticket_url,
                    distance_miles: distance,
                    is_favorite: isFavorite
                  });
                }
              }
            }
          } catch (err) {
            console.error('Error calculating distance for show:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching nearby shows:', err);
      }
    }

    // 3. Get upcoming shows for favorite artists (not already included in nearby)
    if (favoriteArtistIds.length > 0) {
      const upcomingFavorites = await c.env.DB.prepare(
        `SELECT 
          artist_tour_dates.*,
          artists.name as artist_name,
          artists.image_url as artist_image,
          venues.name as venue_name,
          venues.location as venue_location
        FROM artist_tour_dates
        LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
        LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
        WHERE artist_tour_dates.artist_id IN (${favoriteArtistIds.map(() => '?').join(',')})
        AND artist_tour_dates.date >= datetime('now')
        AND artist_tour_dates.date <= datetime('now', '+90 days')
        ORDER BY artist_tour_dates.date ASC`
      )
        .bind(...favoriteArtistIds)
        .all();

      for (const show of (upcomingFavorites.results || [])) {
        // Avoid duplicates from nearby section
        const isDuplicate = prioritizedShows.some(
          s => s.type === 'nearby_upcoming' && 
               s.artist_name === (show as any).artist_name && 
               s.venue_name === (show as any).venue_name &&
               s.date === (show as any).date
        );
        
        if (!isDuplicate) {
          prioritizedShows.push({
            type: 'upcoming_favorite',
            priority: 3,
            artist_name: (show as any).artist_name,
            artist_image: (show as any).artist_image,
            venue_name: (show as any).venue_name,
            venue_location: (show as any).venue_location,
            date: (show as any).date,
            ticket_url: (show as any).ticket_url,
            is_favorite: true
          });
        }
      }
    }

    // 4. Get favorite artists (general - with recent clips)
    if (favoriteArtistIds.length > 0) {
      const favoriteArtists = await c.env.DB.prepare(
        `SELECT 
          artists.*,
          COUNT(DISTINCT clips.id) as clip_count,
          MAX(clips.created_at) as latest_clip
        FROM artists
        LEFT JOIN clips ON clips.artist_name = artists.name AND clips.is_hidden = 0
        WHERE artists.id IN (${favoriteArtistIds.map(() => '?').join(',')})
        GROUP BY artists.id
        HAVING clip_count > 0
        ORDER BY latest_clip DESC`
      )
        .bind(...favoriteArtistIds)
        .all();

      for (const artist of (favoriteArtists.results || [])) {
        prioritizedShows.push({
          type: 'favorite_artist',
          priority: 4,
          artist_name: (artist as any).name,
          artist_image: (artist as any).image_url,
          bio: (artist as any).bio,
          clip_count: (artist as any).clip_count,
          is_favorite: true
        });
      }
    }

    // 5. General trending content (recent popular clips)
    const trendingClips = await c.env.DB.prepare(
      `SELECT 
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar,
        artists.image_url as artist_image
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      LEFT JOIN artists ON clips.artist_name = artists.name
      WHERE clips.is_hidden = 0
      AND clips.created_at >= date('now', '-7 days')
      ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC
      LIMIT 20`
    ).all();

    for (const clip of (trendingClips.results || [])) {
      const isFavorite = favoriteArtistNames.includes((clip as any).artist_name);
      
      prioritizedShows.push({
        type: 'trending',
        priority: 5,
        artist_name: (clip as any).artist_name,
        artist_image: (clip as any).artist_image,
        venue_name: (clip as any).venue_name,
        location: (clip as any).location,
        is_favorite: isFavorite,
        clip: clip
      });
    }

    // Sort by priority, then by additional factors
    prioritizedShows.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Within same priority, sort by:
      // 1. Favorites first
      if (a.is_favorite !== b.is_favorite) {
        return b.is_favorite ? 1 : -1;
      }
      
      // 2. Closer shows first (if distance available)
      if (a.distance_miles && b.distance_miles) {
        return a.distance_miles - b.distance_miles;
      }
      
      // 3. More moments/clips first
      const aCount = a.moments_count || a.clip_count || 0;
      const bCount = b.moments_count || b.clip_count || 0;
      return bCount - aCount;
    });

    return c.json({ shows: prioritizedShows });
  } catch (error) {
    console.error('Get prioritized shows error:', error);
    return c.json({ error: 'Failed to get prioritized shows' }, 500);
  }
}

/**
 * Get clips from a specific show (by show_id)
 */
export async function getShowClips(c: Context) {
  const artistNameParam = c.req.param('artistName');
  if (artistNameParam === undefined) {
    return c.json({ error: 'artistName is required' }, 400);
  }
  const artistName = await resolveArtistNameForClipsQuery(
    c.env.DB,
    c.env.JAMBASE_API_KEY,
    artistNameParam
  );
  const showId = c.req.param('showId');
  const sortBy = c.req.query('sort_by') || 'time_posted';
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.artist_name = ?
      AND clips.show_id = ?
      AND clips.is_hidden = 0
    `;

    const bindings: any[] = [artistName, showId];

    // Apply sorting
    switch (sortBy) {
      case 'clip_rating':
        query += ' ORDER BY clips.average_rating DESC, clips.created_at DESC';
        break;
      case 'time_posted':
      default:
        query += ' ORDER BY clips.created_at ASC';
        break;
    }

    query += ' LIMIT ? OFFSET ?';
    bindings.push(String(limit), String(offset));

    const clips = await c.env.DB.prepare(query)
      .bind(...bindings)
      .all();

    return c.json({
      clips: clips.results || [],
      page,
      limit,
      hasMore: (clips.results || []).length === limit
    });
  } catch (error) {
    console.error('Get show clips error:', error);
    return c.json({ error: 'Failed to get show clips' }, 500);
  }
}

/**
 * Get venue archive (past shows)
 */
export async function getVenueArchive(c: Context) {
  const venueNameParam = c.req.param('venueName');
  if (venueNameParam === undefined) {
    return c.json({ error: 'venueName is required' }, 400);
  }
  const venueName = decodeURIComponent(venueNameParam);
  const sortBy = c.req.query('sort_by') || 'date_played';
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  try {
    // Get distinct shows at venue (grouped by show_id)
    let query = `
      SELECT 
        clips.show_id,
        clips.artist_name,
        MIN(clips.timestamp) as show_date,
        COUNT(DISTINCT clips.id) as clip_count,
        AVG(clips.average_rating) as average_show_rating,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM clips
      WHERE clips.venue_name = ?
      AND clips.is_hidden = 0
      AND clips.show_id IS NOT NULL
      GROUP BY clips.show_id, clips.artist_name
    `;

    const bindings: any[] = [venueName];

    // Apply sorting
    switch (sortBy) {
      case 'average_rating':
        query += ' ORDER BY average_show_rating DESC';
        break;
      case 'date_played':
      default:
        query += ' ORDER BY show_date DESC';
        break;
    }

    query += ' LIMIT ? OFFSET ?';
    bindings.push(String(limit), String(offset));

    const shows = await c.env.DB.prepare(query)
      .bind(...bindings)
      .all();

    return c.json({
      shows: shows.results || [],
      page,
      limit,
      hasMore: (shows.results || []).length === limit
    });
  } catch (error) {
    console.error('Get venue archive error:', error);
    return c.json({ error: 'Failed to get venue archive' }, 500);
  }
}
