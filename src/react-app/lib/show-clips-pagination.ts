import type { ClipWithUser } from '@/shared/types';
import { apiShowClipsPath } from '@/shared/app-paths';

export const SHOW_CLIPS_PAGE_SIZE = 20;

export type ShowClipsSort = 'time_posted' | 'most_liked';

interface FetchShowClipsPageOptions {
  artistName: string;
  showId: string;
  sortBy: ShowClipsSort;
  page: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface ShowClipsPage {
  clips: ClipWithUser[];
  hasMore: boolean;
}

export async function fetchShowClipsPage({
  artistName,
  showId,
  sortBy,
  page,
  signal,
  fetchImpl = fetch,
}: FetchShowClipsPageOptions): Promise<ShowClipsPage> {
  const params = new URLSearchParams({
    sort_by: sortBy,
    page: String(page),
    limit: String(SHOW_CLIPS_PAGE_SIZE),
  });
  const response = await fetchImpl(`${apiShowClipsPath(artistName, showId)}?${params}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch show clips');
  }

  const data = (await response.json()) as Partial<ShowClipsPage>;
  return {
    clips: Array.isArray(data.clips) ? data.clips : [],
    hasMore: Boolean(data.hasMore),
  };
}

export function appendUniqueShowClips(
  existing: ClipWithUser[],
  incoming: ClipWithUser[],
): ClipWithUser[] {
  const ids = new Set(existing.map((clip) => clip.id));
  return [
    ...existing,
    ...incoming.filter((clip) => {
      if (ids.has(clip.id)) return false;
      ids.add(clip.id);
      return true;
    }),
  ];
}
