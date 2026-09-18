import type { ClipWithUser } from '@/shared/types';
import type { StoredShowPage } from '@/shared/jambase-setlist';
import { apiShowClipsPath } from '@/shared/app-paths';
import {
  eventStartIsoFromPayload,
  sortClipsBySetlistThenRecorded,
} from '@/shared/clip-setlist-order';

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
  show: StoredShowPage | null;
  canonical_show_id: string | null;
}

type FetchAllShowClipsOptions = Omit<FetchShowClipsPageOptions, 'page'>;

function parseStoredShow(value: unknown): StoredShowPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!row.event || typeof row.event !== 'object' || Array.isArray(row.event)) return null;
  const setlist = Array.isArray(row.setlist)
    ? row.setlist.filter(
        (song): song is { title: string; artist?: string } =>
          Boolean(song && typeof song === 'object' && typeof (song as { title?: unknown }).title === 'string'),
      )
    : [];
  const setlistUrl =
    typeof row.setlist_url === 'string' &&
    row.setlist_url.trim() &&
    !/setlist\.fm/i.test(row.setlist_url)
      ? row.setlist_url.trim()
      : null;
  return {
    event: row.event as Record<string, unknown>,
    setlist,
    setlist_url: setlistUrl,
    htmlChecked: row.htmlChecked === true,
  };
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

  const data = (await response.json()) as Partial<ShowClipsPage> & {
    canonical_show_id?: string | null;
  };
  const canonical =
    typeof data.canonical_show_id === 'string' && data.canonical_show_id.trim()
      ? data.canonical_show_id.trim()
      : null;
  return {
    clips: Array.isArray(data.clips) ? data.clips : [],
    hasMore: Boolean(data.hasMore),
    show: parseStoredShow(data.show),
    canonical_show_id: canonical,
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

export async function fetchAllShowClips(
  options: FetchAllShowClipsOptions,
): Promise<{
  clips: ClipWithUser[];
  show: StoredShowPage | null;
  canonical_show_id: string | null;
}> {
  let clips: ClipWithUser[] = [];
  let show: StoredShowPage | null = null;
  let canonicalShowId: string | null = null;

  for (let page = 1; ; page += 1) {
    const result = await fetchShowClipsPage({ ...options, page });
    if (result.show) show = result.show;
    if (result.canonical_show_id) canonicalShowId = result.canonical_show_id;
    clips = appendUniqueShowClips(clips, result.clips);

    if (!result.hasMore || result.clips.length === 0) {
      const setlist = show?.setlist;
      const ordered =
        options.sortBy === 'most_liked'
          ? clips
          : sortClipsBySetlistThenRecorded(
              clips,
              setlist,
              eventStartIsoFromPayload(show?.event),
              show?.event ?? null,
            );
      return { clips: ordered, show, canonical_show_id: canonicalShowId };
    }
  }
}
