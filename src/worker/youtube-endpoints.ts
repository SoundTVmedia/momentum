import type { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';
import {
  aggregateFavoriteArtistVideos,
  fetchChannelVideoPool,
  resolveYoutubeChannelId,
  youtubeApiKeyConfigured,
  youtubeMissingKeyNotice,
  type YoutubeVideoDto,
} from './youtube-client';
import { cacheJsonProxy } from './performance-utils';

const MAX_FAVORITE_ARTISTS = 8;
const PER_LIST_DEFAULT = 6;
const PER_LIST_MAX = 12;
const VIDEO_POOL_PER_CHANNEL = 35;

type FavoriteArtistRow = {
  artist_id: number;
  name: string;
  social_links: string | null;
  youtube_channel_id: string | null;
};

export async function getFavoriteArtistYoutubeVideos(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const apiKey = c.env.YOUTUBE_API_KEY;
  if (!youtubeApiKeyConfigured(apiKey)) {
    cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 120 });
    return c.json({
      configured: false,
      message: youtubeMissingKeyNotice(),
      mostViewed: [] as YoutubeVideoDto[],
      mostLiked: [] as YoutubeVideoDto[],
    });
  }

  const limitRaw = Number.parseInt(c.req.query('limit') || String(PER_LIST_DEFAULT), 10);
  const perListLimit = Number.isFinite(limitRaw)
    ? Math.min(PER_LIST_MAX, Math.max(1, limitRaw))
    : PER_LIST_DEFAULT;

  const uid = mochaUserIdKey(mochaUser);

  try {
    const favorites = await c.env.DB.prepare(
      `SELECT
        user_favorite_artists.artist_id,
        artists.name,
        artists.social_links,
        artists.youtube_channel_id
      FROM user_favorite_artists
      LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
      WHERE user_favorite_artists.mocha_user_id = ?
      ORDER BY user_favorite_artists.created_at DESC
      LIMIT ?`,
    )
      .bind(uid, MAX_FAVORITE_ARTISTS)
      .all();

    const rows = (favorites.results ?? []) as FavoriteArtistRow[];
    const artists = rows.filter((r) => typeof r.name === 'string' && r.name.trim().length > 0);

    if (artists.length === 0) {
      cacheJsonProxy(c, { browserMaxAge: 30, cdnMaxAge: 120 });
      return c.json({
        configured: true,
        mostViewed: [],
        mostLiked: [],
        message: 'No favorite artists set',
      });
    }

    const pools: { artistName: string; videos: YoutubeVideoDto[] }[] = [];

    for (const artist of artists) {
      const artistName = String(artist.name).trim();
      let channelId =
        typeof artist.youtube_channel_id === 'string' && artist.youtube_channel_id.trim()
          ? artist.youtube_channel_id.trim()
          : null;

      if (!channelId) {
        channelId = await resolveYoutubeChannelId(
          apiKey,
          artistName,
          artist.social_links,
        );
        if (channelId && artist.artist_id) {
          await c.env.DB.prepare(
            `UPDATE artists SET youtube_channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          )
            .bind(channelId, artist.artist_id)
            .run();
        }
      }

      if (!channelId) continue;

      try {
        const videos = await fetchChannelVideoPool(apiKey, channelId, VIDEO_POOL_PER_CHANNEL);
        const withArtist = videos.map((v) => ({ ...v, artistName }));
        pools.push({ artistName, videos: withArtist });
      } catch (e) {
        console.error('YouTube channel pool failed for', artistName, e);
      }
    }

    const { mostViewed, mostLiked } = aggregateFavoriteArtistVideos(pools, perListLimit);

    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 900 });
    return c.json({
      configured: true,
      mostViewed,
      mostLiked,
      artistCount: pools.length,
    });
  } catch (error) {
    console.error('getFavoriteArtistYoutubeVideos error:', error);
    return c.json({ error: 'Failed to load YouTube videos' }, 500);
  }
}
