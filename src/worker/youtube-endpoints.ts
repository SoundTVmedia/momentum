import type { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';
import { loadFavoriteArtistsForYoutube } from './youtube-favorite-artists';
import {
  aggregateFavoriteArtistVideos,
  fetchChannelVideoPool,
  fetchVideosByArtistSearch,
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
const SEARCH_FALLBACK_PER_ARTIST = 15;

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
    const artists = await loadFavoriteArtistsForYoutube(
      c.env.DB,
      uid,
      MAX_FAVORITE_ARTISTS,
    );

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
    let channelsResolved = 0;
    const failures: string[] = [];

    for (const artist of artists) {
      const artistName = artist.name.trim();
      let channelId = artist.youtube_channel_id;
      let videos: YoutubeVideoDto[] = [];

      if (!channelId) {
        try {
          channelId = await resolveYoutubeChannelId(apiKey, artistName, artist.social_links);
          if (channelId && artist.artist_id) {
            await c.env.DB.prepare(
              `UPDATE artists SET youtube_channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            )
              .bind(channelId, artist.artist_id)
              .run();
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('YouTube channel resolve failed for', artistName, e);
          failures.push(`${artistName}: ${msg}`);
        }
      }

      if (channelId) {
        channelsResolved += 1;
        try {
          videos = await fetchChannelVideoPool(apiKey, channelId, VIDEO_POOL_PER_CHANNEL);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('YouTube channel pool failed for', artistName, e);
          failures.push(`${artistName}: ${msg}`);
        }
      }

      if (videos.length === 0) {
        try {
          videos = await fetchVideosByArtistSearch(
            apiKey,
            artistName,
            SEARCH_FALLBACK_PER_ARTIST,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('YouTube search fallback failed for', artistName, e);
          failures.push(`${artistName}: ${msg}`);
        }
      }

      if (videos.length > 0) {
        pools.push({
          artistName,
          videos: videos.map((v) => ({ ...v, artistName })),
        });
      }
    }

    const { mostViewed, mostLiked } = aggregateFavoriteArtistVideos(pools, perListLimit);

    let message: string | undefined;
    if (mostViewed.length === 0 && mostLiked.length === 0) {
      const hint = failures[0] ?? '';
      if (/quota|dailyLimit|rateLimit/i.test(hint)) {
        message = 'YouTube API quota exceeded. Try again tomorrow or raise quota in Google Cloud Console.';
      } else if (/referer|referrer|API key not valid|forbidden|403/i.test(hint)) {
        message =
          'YouTube API key rejected (often HTTP referrer restrictions). Use a server key with no referrer restriction.';
      } else if (channelsResolved === 0) {
        message =
          'Could not match your favorite artists to YouTube channels. Try adding official YouTube links on artist profiles.';
      } else {
        message = 'No YouTube videos found for your favorite artists right now.';
      }
    }

    cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 900 });
    return c.json({
      configured: true,
      mostViewed,
      mostLiked,
      artistCount: artists.length,
      channelsResolved,
      message,
    });
  } catch (error) {
    console.error('getFavoriteArtistYoutubeVideos error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load YouTube videos';
    return c.json({ error: msg }, 500);
  }
}
