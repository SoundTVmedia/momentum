import { slugifyEntityName } from '../shared/jambase-slug';
import { resolveArtistNameForClipsQuery } from './artist-venue-pages';
import {
  getCachedArtistVideoPool,
  getYoutubeCachedPayload,
  isYoutubeQuotaExceededError,
  setCachedArtistVideoPool,
  setYoutubeCachedPayload,
  youtubeChannelResolveCacheKey,
  youtubeQuotaFromEnv,
  type YoutubeQuotaContext,
  type YoutubeQuotaEnv,
} from './youtube-cache';
import {
  fetchChannelVideoPool,
  fetchVideosByArtistSearch,
  resolveYoutubeChannelId,
  type YoutubeVideoDto,
} from './youtube-client';

const VIDEO_POOL_PER_CHANNEL = 40;
const SEARCH_FALLBACK_MAX = 20;

export type ArtistYoutubeRow = {
  artist_id: number | null;
  name: string;
  social_links: string | null;
  youtube_channel_id: string | null;
};

export async function lookupArtistForYoutube(
  db: D1Database,
  artistNameParam: string,
  jambaseApiKey?: string,
): Promise<ArtistYoutubeRow | null> {
  const param = artistNameParam.trim();
  if (!param) return null;

  const slug = slugifyEntityName(param);
  const canonicalName = (
    await resolveArtistNameForClipsQuery(db, jambaseApiKey, param, undefined)
  ).trim();

  let row = (await db
    .prepare(
      `SELECT id, name, social_links, youtube_channel_id
       FROM artists
       WHERE LOWER(REPLACE(TRIM(name), ' ', '-')) = ? OR name = ? OR TRIM(name) = ?
       LIMIT 1`,
    )
    .bind(slug, canonicalName, param)
    .first()) as {
    id?: unknown;
    name?: unknown;
    social_links?: unknown;
    youtube_channel_id?: unknown;
  } | null;

  if (!row && canonicalName) {
    row = (await db
      .prepare(
        `SELECT id, name, social_links, youtube_channel_id FROM artists WHERE name = ? LIMIT 1`,
      )
      .bind(canonicalName)
      .first()) as typeof row;
  }

  if (!row) {
    const displayName = canonicalName || param.replace(/-/g, ' ');
    if (!displayName.trim()) return null;
    return {
      artist_id: null,
      name: displayName.trim(),
      social_links: null,
      youtube_channel_id: null,
    };
  }

  const artistId = typeof row.id === 'number' ? row.id : Number(row.id);
  const name = typeof row.name === 'string' ? row.name.trim() : canonicalName || param;
  if (!name) return null;

  return {
    artist_id: Number.isFinite(artistId) && artistId > 0 ? artistId : null,
    name,
    social_links: typeof row.social_links === 'string' ? row.social_links : null,
    youtube_channel_id:
      typeof row.youtube_channel_id === 'string' && row.youtube_channel_id.trim()
        ? row.youtube_channel_id.trim()
        : null,
  };
}

/** Load a pool of videos for one artist (D1 cache → channel uploads → search fallback). */
export async function fetchYoutubeVideosForArtist(
  db: D1Database,
  apiKey: string,
  artist: ArtistYoutubeRow,
  quota?: YoutubeQuotaContext,
): Promise<YoutubeVideoDto[]> {
  const artistName = artist.name.trim();
  let channelId = artist.youtube_channel_id;

  const cached = await getCachedArtistVideoPool(db, channelId, artistName, true);
  if (cached && cached.length > 0) {
    return cached.map((v) => ({ ...v, artistName }));
  }

  let videos: YoutubeVideoDto[] = [];

  if (!channelId) {
    const channelCacheKey = youtubeChannelResolveCacheKey(artistName);
    const cachedChannel = await getYoutubeCachedPayload<string>(db, channelCacheKey, {
      allowStaleDays: 14,
    });
    if (cachedChannel) {
      channelId = cachedChannel;
    } else {
      try {
        channelId = await resolveYoutubeChannelId(apiKey, artistName, artist.social_links, quota);
        if (channelId) {
          await setYoutubeCachedPayload(db, channelCacheKey, channelId, 14 * 86_400);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isYoutubeQuotaExceededError(msg)) throw e;
        console.error('YouTube channel resolve failed for', artistName, e);
      }
    }

    if (channelId && artist.artist_id) {
      await db
        .prepare(
          `UPDATE artists SET youtube_channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(channelId, artist.artist_id)
        .run();
    }
  }

  if (channelId) {
    try {
      videos = await fetchChannelVideoPool(apiKey, channelId, VIDEO_POOL_PER_CHANNEL, quota);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isYoutubeQuotaExceededError(msg)) throw e;
      console.error('YouTube channel pool failed for', artistName, e);
    }
  }

  if (videos.length === 0) {
    try {
      videos = await fetchVideosByArtistSearch(apiKey, artistName, SEARCH_FALLBACK_MAX, quota);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isYoutubeQuotaExceededError(msg)) throw e;
      console.error('YouTube search fallback failed for', artistName, e);
    }
  }

  const withNames = videos.map((v) => ({ ...v, artistName }));
  if (withNames.length > 0) {
    await setCachedArtistVideoPool(db, channelId, artistName, withNames);
  }

  return withNames;
}

export function youtubeQuotaForEnv(
  db: D1Database,
  env: YoutubeQuotaEnv,
): YoutubeQuotaContext | undefined {
  return youtubeQuotaFromEnv({ ...env, DB: db });
}

export function topYoutubeVideosByViews(videos: YoutubeVideoDto[], limit: number): YoutubeVideoDto[] {
  const seen = new Set<string>();
  return [...videos]
    .sort((a, b) => b.viewCount - a.viewCount)
    .filter((v) => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    })
    .slice(0, limit);
}

export function topYoutubeVideosByLikes(videos: YoutubeVideoDto[], limit: number): YoutubeVideoDto[] {
  const seen = new Set<string>();
  return [...videos]
    .sort((a, b) => b.likeCount - a.likeCount)
    .filter((v) => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    })
    .slice(0, limit);
}
