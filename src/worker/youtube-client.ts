const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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
): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  url.searchParams.set('key', apiKey.trim());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    const msg = body?.error?.message ?? `YouTube API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
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

async function resolveChannelIdByHandle(apiKey: string, handle: string): Promise<string | null> {
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  if (!clean.trim()) return null;
  const data = await youtubeGet<YoutubeListResponse<ChannelItem>>(apiKey, '/channels', {
    part: 'id',
    forHandle: clean,
  });
  return data.items?.[0]?.id ?? null;
}

/** Resolve a YouTube channel id for an artist display name. */
export async function resolveYoutubeChannelId(
  apiKey: string,
  artistName: string,
  socialLinksJson?: string | null,
): Promise<string | null> {
  const fromSocial = parseYoutubeChannelIdFromSocialLinks(socialLinksJson);
  if (fromSocial) {
    if (fromSocial.startsWith('@')) {
      const byHandle = await resolveChannelIdByHandle(apiKey, fromSocial);
      if (byHandle) return byHandle;
    } else {
      return fromSocial;
    }
  }

  const handle = parseYoutubeHandleFromSocialLinks(socialLinksJson);
  if (handle) {
    const byHandle = await resolveChannelIdByHandle(apiKey, handle);
    if (byHandle) return byHandle;
  }

  const data = await youtubeGet<YoutubeListResponse<SearchChannelItem>>(apiKey, '/search', {
    part: 'snippet',
    type: 'channel',
    q: `${artistName} official`,
    maxResults: '8',
  });

  const items = data.items ?? [];
  if (items.length === 0) return null;

  const exact = items.find((item) => {
    const title = item.snippet?.channelTitle ?? item.snippet?.title ?? '';
    return channelTitleMatchesArtist(title, artistName);
  });
  const pick = exact ?? items[0];
  return pick?.id?.channelId ?? null;
}

async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string | null> {
  const data = await youtubeGet<YoutubeListResponse<ChannelItem>>(apiKey, '/channels', {
    part: 'contentDetails',
    id: channelId,
  });
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

async function listUploadVideoIds(apiKey: string, playlistId: string, maxResults: number): Promise<string[]> {
  const data = await youtubeGet<YoutubeListResponse<PlaylistItem>>(apiKey, '/playlistItems', {
    part: 'contentDetails',
    playlistId,
    maxResults: String(Math.min(50, Math.max(1, maxResults))),
  });
  const ids: string[] = [];
  for (const item of data.items ?? []) {
    const id = item.contentDetails?.videoId;
    if (id) ids.push(id);
  }
  return ids;
}

async function fetchVideoDetails(apiKey: string, videoIds: string[]): Promise<VideoItem[]> {
  if (videoIds.length === 0) return [];
  const data = await youtubeGet<YoutubeListResponse<VideoItem>>(apiKey, '/videos', {
    part: 'snippet,statistics',
    id: videoIds.join(','),
  });
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
): Promise<YoutubeVideoDto[]> {
  const data = await youtubeGet<YoutubeListResponse<SearchVideoItem>>(apiKey, '/search', {
    part: 'snippet',
    type: 'video',
    q: artistName,
    order: 'viewCount',
    maxResults: String(Math.min(25, Math.max(1, maxResults))),
  });

  const ids = (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (ids.length === 0) return [];

  const details = await fetchVideoDetails(apiKey, ids);
  return details
    .map((v) => toDto(v, artistName))
    .filter((v): v is YoutubeVideoDto => v !== null);
}

/** Pool of recent uploads for a channel (used to rank globally). */
export async function fetchChannelVideoPool(
  apiKey: string,
  channelId: string,
  poolSize = 40,
): Promise<YoutubeVideoDto[]> {
  const playlistId = await getUploadsPlaylistId(apiKey, channelId);
  if (!playlistId) return [];

  const videoIds = await listUploadVideoIds(apiKey, playlistId, poolSize);
  const details = await fetchVideoDetails(apiKey, videoIds);
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
