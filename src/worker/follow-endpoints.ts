import type { Context } from 'hono';
import { createRealtimeService } from './realtime-service';
import { parseD1LastRowId } from './mocha-user-id';
import {
  getOrCreateArtistIdByName,
  loadCanonicalFavoriteArtistNames,
  mochaUserIdKey,
  toggleArtistFollowFavorite,
} from './favorite-artists-sync';

function artistNameFollowKey(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return `artist-name:${normalized}`;
}

/** `follows.following_id` values that refer to another user account. */
export function isUserFollowTargetId(followingId: string): boolean {
  const id = followingId.trim();
  if (!id) return false;
  if (id.startsWith('venue-')) return false;
  if (/^artist-\d+$/.test(id)) return false;
  if (id.startsWith('artist-name:')) return false;
  return true;
}

/** Users, artists, and venues the signed-in account follows (for profile following modal). */
export async function getMyFollowingList(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  try {
    const followRows = await c.env.DB.prepare(
      `SELECT following_id, created_at
       FROM follows
       WHERE follower_id = ?
       ORDER BY created_at DESC`,
    )
      .bind(uid)
      .all();

    const userIds: string[] = [];
    const venueIds: number[] = [];
    for (const row of followRows.results || []) {
      const fid = String((row as { following_id?: unknown }).following_id ?? '').trim();
      if (isUserFollowTargetId(fid)) {
        userIds.push(fid);
      } else {
        const vm = /^venue-(\d+)$/.exec(fid);
        if (vm) {
          const id = Number(vm[1]);
          if (Number.isFinite(id) && id > 0) venueIds.push(Math.trunc(id));
        }
      }
    }

    const users: Record<string, unknown>[] = [];
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const profiles = await c.env.DB.prepare(
        `SELECT mocha_user_id, display_name, profile_image_url, role, is_verified
         FROM user_profiles
         WHERE mocha_user_id IN (${placeholders})`,
      )
        .bind(...userIds)
        .all();

      const byId = new Map<string, Record<string, unknown>>();
      for (const row of profiles.results || []) {
        const id = String((row as { mocha_user_id?: unknown }).mocha_user_id ?? '');
        if (id) byId.set(id, row as Record<string, unknown>);
      }

      for (const id of userIds) {
        const profile = byId.get(id);
        users.push({
          mocha_user_id: id,
          display_name:
            typeof profile?.display_name === 'string' ? profile.display_name : null,
          profile_image_url:
            typeof profile?.profile_image_url === 'string'
              ? profile.profile_image_url
              : null,
          role: typeof profile?.role === 'string' ? profile.role : 'fan',
          is_verified:
            profile?.is_verified === 1 || profile?.is_verified === true ? 1 : 0,
        });
      }
    }

    const venues: Record<string, unknown>[] = [];
    if (venueIds.length > 0) {
      const vph = venueIds.map(() => '?').join(',');
      const venueRows = await c.env.DB.prepare(
        `SELECT id, name, location, image_url FROM venues WHERE id IN (${vph})`,
      )
        .bind(...venueIds)
        .all();

      const byVenueId = new Map<number, Record<string, unknown>>();
      for (const row of venueRows.results || []) {
        const id = Number((row as { id?: unknown }).id);
        if (Number.isFinite(id)) byVenueId.set(Math.trunc(id), row as Record<string, unknown>);
      }

      for (const id of venueIds) {
        const row = byVenueId.get(id);
        venues.push({
          venue_id: id,
          name: typeof row?.name === 'string' ? row.name : 'Venue',
          location: typeof row?.location === 'string' ? row.location : null,
          image_url: typeof row?.image_url === 'string' ? row.image_url : null,
        });
      }
    }

    const artistRows = await c.env.DB.prepare(
      `SELECT artists.id AS artist_id, artists.name, artists.image_url
       FROM user_favorite_artists
       LEFT JOIN artists ON artists.id = user_favorite_artists.artist_id
       WHERE user_favorite_artists.mocha_user_id = ?
       ORDER BY user_favorite_artists.created_at DESC`,
    )
      .bind(uid)
      .all();

    const artists: { artist_id: number; name: string; image_url: string | null }[] = [];
    const seenNames = new Set<string>();
    for (const row of artistRows.results || []) {
      const name = String((row as { name?: unknown }).name ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      const artistId = Number((row as { artist_id?: unknown }).artist_id);
      artists.push({
        artist_id: Number.isFinite(artistId) && artistId > 0 ? Math.trunc(artistId) : 0,
        name,
        image_url:
          typeof (row as { image_url?: unknown }).image_url === 'string'
            ? (row as { image_url: string }).image_url
            : null,
      });
    }

    const canonicalNames = await loadCanonicalFavoriteArtistNames(c.env.DB, uid, 50);
    for (const name of canonicalNames) {
      const key = name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      artists.push({ artist_id: 0, name, image_url: null });
    }

    return c.json({ users, artists, venues });
  } catch (error) {
    console.error('getMyFollowingList error:', error);
    return c.json({ error: 'Failed to load following list' }, 500);
  }
}

/** Profiles of users the signed-in account follows (excludes artists and venues). */
export async function getMyFollowingUsers(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  try {
    const followRows = await c.env.DB.prepare(
      `SELECT following_id, created_at
       FROM follows
       WHERE follower_id = ?
       ORDER BY created_at DESC`,
    )
      .bind(uid)
      .all();

    const userIds: string[] = [];
    for (const row of followRows.results || []) {
      const fid = String((row as { following_id?: unknown }).following_id ?? '').trim();
      if (isUserFollowTargetId(fid)) userIds.push(fid);
    }

    if (userIds.length === 0) {
      return c.json({ users: [] });
    }

    const placeholders = userIds.map(() => '?').join(',');
    const profiles = await c.env.DB.prepare(
      `SELECT
         mocha_user_id,
         display_name,
         profile_image_url,
         role,
         is_verified
       FROM user_profiles
       WHERE mocha_user_id IN (${placeholders})`,
    )
      .bind(...userIds)
      .all();

    const byId = new Map<string, Record<string, unknown>>();
    for (const row of profiles.results || []) {
      const id = String((row as { mocha_user_id?: unknown }).mocha_user_id ?? '');
      if (id) byId.set(id, row as Record<string, unknown>);
    }

    const users = userIds.map((id) => {
      const profile = byId.get(id);
      return {
        mocha_user_id: id,
        display_name:
          typeof profile?.display_name === 'string' ? profile.display_name : null,
        profile_image_url:
          typeof profile?.profile_image_url === 'string'
            ? profile.profile_image_url
            : null,
        role: typeof profile?.role === 'string' ? profile.role : 'fan',
        is_verified:
          profile?.is_verified === 1 || profile?.is_verified === true ? 1 : 0,
      };
    });

    return c.json({ users });
  } catch (error) {
    console.error('getMyFollowingUsers error:', error);
    return c.json({ error: 'Failed to load following users' }, 500);
  }
}

/** All follow targets for the signed-in user (users, venues, artists). */
export async function getMyFollowing(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);

  try {
    const ids = new Set<string>();

    const followRows = await c.env.DB.prepare(
      'SELECT following_id FROM follows WHERE follower_id = ?',
    )
      .bind(uid)
      .all();

    for (const row of followRows.results || []) {
      const fid = String((row as { following_id?: unknown }).following_id ?? '').trim();
      if (fid) ids.add(fid);
    }

    const artistNames = await loadCanonicalFavoriteArtistNames(c.env.DB, uid, 50);
    for (const name of artistNames) {
      ids.add(artistNameFollowKey(name));
    }

    const favRows = await c.env.DB.prepare(
      `SELECT user_favorite_artists.artist_id AS artist_id
       FROM user_favorite_artists
       WHERE user_favorite_artists.mocha_user_id = ?`,
    )
      .bind(uid)
      .all();

    for (const row of favRows.results || []) {
      const artistId = Number((row as { artist_id?: unknown }).artist_id);
      if (Number.isFinite(artistId) && artistId > 0) {
        ids.add(`artist-${Math.trunc(artistId)}`);
      }
    }

    return c.json({ following_ids: [...ids] });
  } catch (error) {
    console.error('getMyFollowing error:', error);
    return c.json({ error: 'Failed to load following' }, 500);
  }
}

/** Toggle follow for a user, artist (`artist-{id}`), or venue (`venue-{id}`). */
export async function toggleFollow(c: Context) {
  const mochaUser = c.get('user');

  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetUserId = c.req.param('userId');
  const uid = mochaUserIdKey(mochaUser);
  const artistFollow = /^artist-(\d+)$/.exec(targetUserId);
  const venueFollow = /^venue-(\d+)$/.exec(targetUserId);

  let followBody: { artist_name?: string } = {};
  try {
    followBody = (await c.req.json()) as { artist_name?: string };
  } catch {
    /* empty body is fine */
  }

  if (artistFollow) {
    let artistId = Number(artistFollow[1]);
    if ((!Number.isInteger(artistId) || artistId <= 0) && typeof followBody.artist_name === 'string') {
      try {
        artistId = await getOrCreateArtistIdByName(c.env.DB, followBody.artist_name);
      } catch (err) {
        console.error('follow artist getOrCreateArtistIdByName:', err);
        return c.json({ error: 'Could not resolve artist' }, 400);
      }
    }
    if (!Number.isInteger(artistId) || artistId <= 0) {
      return c.json({ error: 'Invalid artist' }, 400);
    }
    const artistName =
      typeof followBody.artist_name === 'string' ? followBody.artist_name.trim() : '';

    try {
      const result = await toggleArtistFollowFavorite(
        c.env.DB,
        uid,
        artistId,
        artistName,
      );
      return c.json(result);
    } catch (err) {
      console.error('toggleArtistFollowFavorite:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Invalid artist' || msg === 'empty artist name') {
        return c.json({ error: 'Invalid artist' }, 400);
      }
      return c.json({ error: 'Could not update favorite artist' }, 500);
    }
  }

  if (venueFollow) {
    const venueId = Number(venueFollow[1]);
    if (!Number.isInteger(venueId) || venueId <= 0) {
      return c.json({ error: 'Invalid venue' }, 400);
    }

    const venue = await c.env.DB.prepare('SELECT id FROM venues WHERE id = ?')
      .bind(venueId)
      .first();
    if (!venue) {
      return c.json({ error: 'Venue not found' }, 404);
    }

    const venueTarget = `venue-${venueId}`;
    const existing = await c.env.DB.prepare(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
    )
      .bind(uid, venueTarget)
      .first();

    if (existing) {
      await c.env.DB.prepare(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      )
        .bind(uid, venueTarget)
        .run();
      return c.json({ following: false });
    }

    await c.env.DB.prepare(
      'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    )
      .bind(uid, venueTarget)
      .run();
    return c.json({ following: true });
  }

  if (targetUserId === String(mochaUser.id) || targetUserId === uid) {
    return c.json({ error: 'Cannot follow yourself' }, 400);
  }

  const targetProfile = await c.env.DB.prepare(
    'SELECT mocha_user_id FROM user_profiles WHERE mocha_user_id = ?',
  )
    .bind(targetUserId)
    .first();
  if (!targetProfile) {
    return c.json({ error: 'User not found' }, 404);
  }

  const existingFollow = await c.env.DB.prepare(
    'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
  )
    .bind(uid, targetUserId)
    .first();

  if (existingFollow) {
    await c.env.DB.prepare(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
    )
      .bind(uid, targetUserId)
      .run();

    return c.json({ following: false });
  }

  await c.env.DB.prepare(
    'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
  )
    .bind(uid, targetUserId)
    .run();

  const notificationResult = await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
     VALUES (?, 'follow', ?, ?, CURRENT_TIMESTAMP)`,
  )
    .bind(targetUserId, 'started following you', uid)
    .run();

  const notification = await c.env.DB.prepare(
    `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`,
  )
    .bind(parseD1LastRowId(notificationResult.meta.last_row_id))
    .first();

  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastNotification(targetUserId, notification);
  } catch (err) {
    console.error('Failed to broadcast notification:', err);
  }

  return c.json({ following: true });
}
