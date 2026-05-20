import type { Context } from 'hono';
import { mochaUserIdKey } from './mocha-user-id';
import { loadFavoriteArtistsForYoutube } from './youtube-favorite-artists';
import {
  fetchYoutubeVideosForArtist,
  lookupArtistForYoutube,
  topYoutubeVideosByLikes,
  topYoutubeVideosByViews,
  youtubeQuotaForEnv,
} from './youtube-artist-fetch';
import {
  getYoutubeCachedPayload,
  isYoutubeQuotaExceededError,
  setYoutubeCachedPayload,
  youtubeFavoriteFeedCacheKey,
  youtubeVideoPoolCacheKey,
  youtubeVideoPoolSearchCacheKey,
} from './youtube-cache';
import {
  buildFavoriteArtistMostLikedFeed,
  youtubeApiKeyConfigured,
  youtubeMissingKeyNotice,
  type YoutubeVideoDto,
} from './youtube-client';
import { cacheJsonProxy } from './performance-utils';

/** Max favorites to fetch YouTube pools for (matches profile favorite cap). */
const MAX_FAVORITE_ARTISTS = 40;
const PER_LIST_DEFAULT = 20;
const PER_LIST_MAX = 20;
/** Cap artists resolved per request when cache is cold (limits quota burn). */
const MAX_ARTISTS_UPSTREAM_PER_REQUEST = 12;

type FavoriteFeedPayload = {
  configured: boolean;
  mostViewed: YoutubeVideoDto[];
  mostLiked: YoutubeVideoDto[];
  artistCount?: number;
  channelsResolved?: number;
  message?: string;
  cached?: boolean;
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
  const feedCacheKey = youtubeFavoriteFeedCacheKey(uid, perListLimit);

  const cachedFeed = await getYoutubeCachedPayload<FavoriteFeedPayload>(c.env.DB, feedCacheKey, {
    allowStaleDays: 1,
  });
  if (cachedFeed?.mostLiked?.length) {
    cacheJsonProxy(c, { browserMaxAge: 600, cdnMaxAge: 3600, staleWhileRevalidate: 7200 });
    return c.json({ ...cachedFeed, cached: true });
  }

  const quota = youtubeQuotaForEnv(c.env.DB, c.env);

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
    let upstreamArtists = 0;
    const failures: string[] = [];
    let quotaHit = false;

    for (const artist of artists) {
      const artistName = artist.name.trim();
      try {
        const poolKey = artist.youtube_channel_id
          ? youtubeVideoPoolCacheKey(artist.youtube_channel_id)
          : youtubeVideoPoolSearchCacheKey(artistName);
        const cachedPool = await getYoutubeCachedPayload<YoutubeVideoDto[]>(c.env.DB, poolKey, {
          allowStaleDays: 7,
        });

        let videos: YoutubeVideoDto[];
        if (cachedPool && cachedPool.length > 0) {
          videos = cachedPool.map((v) => ({ ...v, artistName }));
        } else {
          if (upstreamArtists >= MAX_ARTISTS_UPSTREAM_PER_REQUEST) {
            continue;
          }
          upstreamArtists += 1;
          videos = await fetchYoutubeVideosForArtist(c.env.DB, apiKey, {
            artist_id: artist.artist_id,
            name: artistName,
            social_links: artist.social_links,
            youtube_channel_id: artist.youtube_channel_id,
          }, quota);
        }

        if (artist.youtube_channel_id || videos.length > 0) {
          channelsResolved += 1;
        }
        if (videos.length > 0) {
          pools.push({ artistName, videos });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isYoutubeQuotaExceededError(msg)) {
          quotaHit = true;
        }
        console.error('YouTube fetch failed for', artistName, e);
        failures.push(`${artistName}: ${msg}`);
      }
    }

    const mostLiked = buildFavoriteArtistMostLikedFeed(pools, perListLimit);
    const mostViewed: YoutubeVideoDto[] = [];

    let message: string | undefined;
    if (mostLiked.length === 0) {
      const hint = failures[0] ?? '';
      if (quotaHit || /quota|dailyLimit|rateLimit/i.test(hint)) {
        message =
          'YouTube API daily quota reached. Showing cached videos when available — try again tomorrow.';
      } else if (/referer|referrer|API key not valid|forbidden|403/i.test(hint)) {
        message =
          'YouTube API key rejected (often HTTP referrer restrictions). Use a server key with no referrer restriction.';
      } else if (channelsResolved === 0) {
        message =
          'Could not match your favorite artists to YouTube channels. Try adding official YouTube links on artist profiles.';
      } else {
        message = 'No YouTube videos found for your favorite artists right now.';
      }
    } else if (quotaHit && upstreamArtists >= MAX_ARTISTS_UPSTREAM_PER_REQUEST) {
      message =
        'Some artists were skipped to preserve YouTube quota. Reload later or add channel links on artist profiles.';
    }

    const payload: FavoriteFeedPayload = {
      configured: true,
      mostViewed,
      mostLiked,
      artistCount: artists.length,
      channelsResolved,
      message,
    };

    if (mostLiked.length > 0) {
      await setYoutubeCachedPayload(c.env.DB, feedCacheKey, payload, 1800);
    }

    cacheJsonProxy(c, { browserMaxAge: 600, cdnMaxAge: 3600, staleWhileRevalidate: 7200 });
    return c.json(payload);
  } catch (error) {
    console.error('getFavoriteArtistYoutubeVideos error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load YouTube videos';
    if (isYoutubeQuotaExceededError(msg) && cachedFeed) {
      cacheJsonProxy(c, { browserMaxAge: 300, cdnMaxAge: 1800 });
      return c.json({ ...cachedFeed, cached: true, message: msg });
    }
    return c.json({ error: msg }, 500);
  }
}

/** Public artist page: most-viewed (and optional most-liked) YouTube videos for one artist. */
export async function getArtistYoutubeVideos(c: Context) {
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

  const artistNameParam = c.req.param('artistName') ?? '';
  const limitRaw = Number.parseInt(c.req.query('limit') || '8', 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(PER_LIST_MAX, Math.max(1, limitRaw))
    : 8;
  const includeLiked = c.req.query('includeLiked') === '1';
  const quota = youtubeQuotaForEnv(c.env.DB, c.env);

  try {
    const artist = await lookupArtistForYoutube(
      c.env.DB,
      artistNameParam,
      c.env.JAMBASE_API_KEY,
    );

    if (!artist) {
      cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300 });
      return c.json({
        configured: true,
        mostViewed: [],
        mostLiked: [],
        message: 'Artist not found',
      });
    }

    const pool = await fetchYoutubeVideosForArtist(c.env.DB, apiKey, artist, quota);
    const mostViewed = topYoutubeVideosByViews(pool, limit);
    const mostLiked = includeLiked ? topYoutubeVideosByLikes(pool, limit) : [];

    cacheJsonProxy(c, { browserMaxAge: 600, cdnMaxAge: 3600, staleWhileRevalidate: 7200 });
    return c.json({
      configured: true,
      artistName: artist.name,
      mostViewed,
      mostLiked,
      message:
        mostViewed.length === 0
          ? 'No YouTube videos found for this artist right now.'
          : undefined,
    });
  } catch (error) {
    console.error('getArtistYoutubeVideos error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load YouTube videos';
    if (isYoutubeQuotaExceededError(msg)) {
      return c.json({
        configured: true,
        mostViewed: [],
        mostLiked: [],
        message:
          'YouTube API daily quota reached. Cached results may appear after the first successful load.',
      });
    }
    return c.json({ error: msg }, 500);
  }
}
