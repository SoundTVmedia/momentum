import {
  youtubeQuotaPrecheck,
  youtubeRecordUpstream,
  youtubeRequestUnits,
  type YoutubeQuotaContext,
} from './youtube-cache';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/** Edge cache TTLs (seconds) — identical URLs share hits across users. */
const TTL_CHANNELS_SEC = 604_800; // 7d — channel id / uploads playlist
const TTL_SEARCH_SEC = 86_400; // 24h — channel & video search
const TTL_VIDEOS_SEC = 21_600; // 6h — video stats/snippets
const TTL_PLAYLIST_ITEMS_SEC = 21_600; // 6h
const TTL_DEFAULT_SEC = 3600;

const inflight = new Map<string, Promise<unknown>>();

function youtubeCacheTtlSeconds(path: string, _params?: Record<string, string>): number {
  if (path === '/search') return TTL_SEARCH_SEC;
  if (path === '/channels') return TTL_CHANNELS_SEC;
  if (path === '/videos') return TTL_VIDEOS_SEC;
  if (path === '/playlistItems') return TTL_PLAYLIST_ITEMS_SEC;
  return TTL_DEFAULT_SEC;
}

function youtubeResponseCountsAsUpstream(res: Response): boolean {
  const s = res.headers.get('cf-cache-status')?.toUpperCase() ?? '';
  return s !== 'HIT';
}

export type { YoutubeQuotaContext };

export type YoutubeVideoDto = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  channelTitle: string;
  artistName: string;
  watchUrl: string;
};

type YoutubeListResponse<T> = {
  items?: T[];
  error?: { message?: string; errors?: { reason?: string }[] };
};

type SearchChannelItem = {
  id?: { channelId?: string };
  snippet?: { channelTitle?: string; title?: string };
};

type SearchVideoItem = {
  id?: { videoId?: string };
};

type ChannelItem = {
  id?: string;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

type PlaylistItem = {
  contentDetails?: { videoId?: string };
};

type VideoItem = {
  id?: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    channelTitle?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string };
};

export function youtubeApiKeyConfigured(apiKey: string | undefined): boolean {
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

export function youtubeMissingKeyNotice(): string {
  return 'YouTube is not configured. Set YOUTUBE_API_KEY in .dev.vars (local) or run `wrangler secret put YOUTUBE_API_KEY` (production), then restart the worker.';
}

/** Extract UC… channel id from a stored social link when present. */
export function parseYoutubeChannelIdFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (!u.hostname.includes('youtube')) return null;
    const channelMatch = u.pathname.match(/\/channel\/(UC[\w-]{10,})/i);
    if (channelMatch) return channelMatch[1];
    const handleMatch = u.pathname.match(/^\/@([^/?#]+)/);
    if (handleMatch) return `@${handleMatch[1]}`;
  } catch {
    /* ignore */
  }
  return null;
}

/** YouTube @handle from social link (not a UC channel id). */
export function parseYoutubeHandleFromSocialLinks(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      try {
        const u = new URL(withProto);
        if (!u.hostname.includes('youtube')) continue;
        const handleMatch = u.pathname.match(/^\/@([^/?#]+)/);
        if (handleMatch) return handleMatch[1];
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function parseYoutubeChannelIdFromSocialLinks(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      const id = parseYoutubeChannelIdFromUrl(value);
      if (id) return id;
      if (/youtube\.com|youtu\.be/i.test(value)) {
        const fromUrl = parseYoutubeChannelIdFromUrl(value);
        if (fromUrl) return fromUrl;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function pickThumbnail(snippet: VideoItem['snippet']): string {
  return (
    snippet?.thumbnails?.high?.url ??
    snippet?.thumbnails?.medium?.url ??
    snippet?.thumbnails?.default?.url ??
    ''
  );
}

async function youtubeGet<T>(
  apiKey: string,
  path: string,
  params: Record<string, string>,
  quota?: YoutubeQuotaContext,
): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  url.searchParams.set('key', apiKey.trim());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const urlKey = url.toString();
  const existing = inflight.get(urlKey) as Promise<T> | undefined;
  if (existing) return existing;

  const units = youtubeRequestUnits(path, params);
  const cacheTtl = youtubeCacheTtlSeconds(path, params);

  const promise = (async (): Promise<T> => {
    if (quota && !(await youtubeQuotaPrecheck(quota, units))) {
      throw new Error('YouTube API quota exceeded for today. Cached results may still be available.');
    }

    const res = await fetch(urlKey, {
      headers: { Accept: 'application/json' },
      cf: {
        cacheEverything: true,
        cacheTtl,
        cacheTtlByStatus: {
          '200-299': cacheTtl,
          '400-499': 300,
          '403': 60,
          '429': 0,
          '500-599': 0,
        },
      },
    });

    const body = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) {
      const msg = body?.error?.message ?? `YouTube API HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (quota && youtubeResponseCountsAsUpstream(res)) {
      await youtubeRecordUpstream(quota, units);
    }

    return body;
  })();

  inflight.set(urlKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(urlKey);
  }
}

function channelTitleMatchesArtist(channelTitle: string, artistName: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const a = norm(artistName);
  const c = norm(channelTitle);
  if (!a || !c) return false;
  return c.includes(a) || a.includes(c);
}

async function resolveChannelIdByHandle(
  apiKey: string,
  handle: string,
  quota?: YoutubeQuotaContext,
): Promise<string | null> {
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  if (!clean.trim()) return null;
  const data = await youtubeGet<YoutubeListResponse<ChannelItem>>(
    apiKey,
    '/channels',
    {
      part: 'id',
      forHandle: clean,
    },
    quota,
  );
  return data.items?.[0]?.id ?? null;
}

/** Resolve a YouTube channel id for an artist display name. */
export async function resolveYoutubeChannelId(
  apiKey: string,
  artistName: string,
  socialLinksJson?: string | null,
  quota?: YoutubeQuotaContext,
): Promise<string | null> {
  const fromSocial = parseYoutubeChannelIdFromSocialLinks(socialLinksJson);
  if (fromSocial) {
    if (fromSocial.startsWith('@')) {
      const byHandle = await resolveChannelIdByHandle(apiKey, fromSocial, quota);
      if (byHandle) return byHandle;
    } else {
      return fromSocial;
    }
  }

  const handle = parseYoutubeHandleFromSocialLinks(socialLinksJson);
  if (handle) {
    const byHandle = await resolveChannelIdByHandle(apiKey, handle, quota);
    if (byHandle) return byHandle;
  }

  const data = await youtubeGet<YoutubeListResponse<SearchChannelItem>>(
    apiKey,
    '/search',
    {
      part: 'snippet',
      type: 'channel',
      q: `${artistName} official`,
      maxResults: '8',
    },
    quota,
  );

  const items = data.items ?? [];
  if (items.length === 0) return null;

  const exact = items.find((item) => {
    const title = item.snippet?.channelTitle ?? item.snippet?.title ?? '';
    return channelTitleMatchesArtist(title, artistName);
  });
  const pick = exact ?? items[0];
  return pick?.id?.channelId ?? null;
}

async function getUploadsPlaylistId(
  apiKey: string,
  channelId: string,
  quota?: YoutubeQuotaContext,
): Promise<string | null> {
  const data = await youtubeGet<YoutubeListResponse<ChannelItem>>(
    apiKey,
    '/channels',
    {
      part: 'contentDetails',
      id: channelId,
    },
    quota,
  );
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

async function listUploadVideoIds(
  apiKey: string,
  playlistId: string,
  maxResults: number,
  quota?: YoutubeQuotaContext,
): Promise<string[]> {
  const data = await youtubeGet<YoutubeListResponse<PlaylistItem>>(
    apiKey,
    '/playlistItems',
    {
      part: 'contentDetails',
      playlistId,
      maxResults: String(Math.min(50, Math.max(1, maxResults))),
    },
    quota,
  );
  const ids: string[] = [];
  for (const item of data.items ?? []) {
    const id = item.contentDetails?.videoId;
    if (id) ids.push(id);
  }
  return ids;
}

async function fetchVideoDetails(
  apiKey: string,
  videoIds: string[],
  quota?: YoutubeQuotaContext,
): Promise<VideoItem[]> {
  if (videoIds.length === 0) return [];
  const data = await youtubeGet<YoutubeListResponse<VideoItem>>(
    apiKey,
    '/videos',
    {
      part: 'snippet,statistics',
      id: videoIds.join(','),
    },
    quota,
  );
  return data.items ?? [];
}

function toDto(item: VideoItem, artistName: string): YoutubeVideoDto | null {
  const videoId = item.id;
  if (!videoId) return null;
  const title = item.snippet?.title?.trim() || 'Video';
  const thumbnailUrl = pickThumbnail(item.snippet);
  const viewCount = Number.parseInt(String(item.statistics?.viewCount ?? '0'), 10) || 0;
  const likeCount = Number.parseInt(String(item.statistics?.likeCount ?? '0'), 10) || 0;
  return {
    videoId,
    title,
    thumbnailUrl,
    viewCount,
    likeCount,
    publishedAt: item.snippet?.publishedAt ?? '',
    channelTitle: item.snippet?.channelTitle ?? '',
    artistName,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/** Fallback: search YouTube for high-view videos matching the artist name. */
export async function fetchVideosByArtistSearch(
  apiKey: string,
  artistName: string,
  maxResults: number,
  quota?: YoutubeQuotaContext,
): Promise<YoutubeVideoDto[]> {
  const data = await youtubeGet<YoutubeListResponse<SearchVideoItem>>(
    apiKey,
    '/search',
    {
      part: 'snippet',
      type: 'video',
      q: artistName,
      order: 'viewCount',
      maxResults: String(Math.min(25, Math.max(1, maxResults))),
    },
    quota,
  );

  const ids = (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (ids.length === 0) return [];

  const details = await fetchVideoDetails(apiKey, ids, quota);
  return details
    .map((v) => toDto(v, artistName))
    .filter((v): v is YoutubeVideoDto => v !== null);
}

/** Pool of recent uploads for a channel (used to rank globally). */
export async function fetchChannelVideoPool(
  apiKey: string,
  channelId: string,
  poolSize = 40,
  quota?: YoutubeQuotaContext,
): Promise<YoutubeVideoDto[]> {
  const playlistId = await getUploadsPlaylistId(apiKey, channelId, quota);
  if (!playlistId) return [];

  const videoIds = await listUploadVideoIds(apiKey, playlistId, poolSize, quota);
  const details = await fetchVideoDetails(apiKey, videoIds, quota);
  return details
    .map((v) => toDto(v, ''))
    .filter((v): v is YoutubeVideoDto => v !== null);
}

/** Merge pools from multiple artists and return global top N by views and by likes. */
export function aggregateFavoriteArtistVideos(
  pools: { artistName: string; videos: YoutubeVideoDto[] }[],
  perListLimit: number,
): { mostViewed: YoutubeVideoDto[]; mostLiked: YoutubeVideoDto[] } {
  const all: YoutubeVideoDto[] = [];
  for (const { artistName, videos } of pools) {
    for (const v of videos) {
      all.push({ ...v, artistName: v.artistName || artistName });
    }
  }

  const dedupeByVideo = (list: YoutubeVideoDto[]) => {
    const seen = new Set<string>();
    return list.filter((v) => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });
  };

  const mostViewed = dedupeByVideo([...all].sort((a, b) => b.viewCount - a.viewCount)).slice(
    0,
    perListLimit,
  );
  const mostLiked = dedupeByVideo([...all].sort((a, b) => b.likeCount - a.likeCount)).slice(
    0,
    perListLimit,
  );

  return { mostViewed, mostLiked };
}

/**
 * Most-liked home feed: one top-liked video per artist first, then fill to `totalLimit`
 * with the next highest-liked videos overall (deduped by videoId).
 */
export function buildFavoriteArtistMostLikedFeed(
  pools: { artistName: string; videos: YoutubeVideoDto[] }[],
  totalLimit: number,
): YoutubeVideoDto[] {
  const seen = new Set<string>();
  const perArtist: YoutubeVideoDto[] = [];

  for (const { artistName, videos } of pools) {
    if (videos.length === 0) continue;

    const sorted = [...videos]
      .map((v) => ({ ...v, artistName: v.artistName || artistName }))
      .sort((a, b) => b.likeCount - a.likeCount);

    const top = sorted[0];
    if (!top || seen.has(top.videoId)) continue;

    seen.add(top.videoId);
    perArtist.push(top);
  }

  if (perArtist.length >= totalLimit) {
    return perArtist.slice(0, totalLimit);
  }

  const result = [...perArtist];
  const rest = pools
    .flatMap(({ artistName, videos }) =>
      videos.map((v) => ({ ...v, artistName: v.artistName || artistName })),
    )
    .filter((v) => !seen.has(v.videoId))
    .sort((a, b) => b.likeCount - a.likeCount);

  for (const v of rest) {
    if (result.length >= totalLimit) break;
    seen.add(v.videoId);
    result.push(v);
  }

  return result;
}
