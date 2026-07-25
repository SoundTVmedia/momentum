import { describe, expect, it, vi } from 'vitest';
import type { ClipWithUser } from '@/shared/types';
import {
  appendUniqueShowClips,
  fetchShowClipsPage,
  SHOW_CLIPS_PAGE_SIZE,
} from './show-clips-pagination';

function clip(id: number): ClipWithUser {
  return { id } as ClipWithUser;
}

describe('show clips pagination', () => {
  it('loads and combines every page of a show with more than 20 clips', async () => {
    const pages = [
      Array.from({ length: 20 }, (_, index) => clip(index + 1)),
      Array.from({ length: 20 }, (_, index) => clip(index + 21)),
      [clip(210)],
    ];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'https://example.com');
      const page = Number(url.searchParams.get('page'));
      expect(url.searchParams.get('limit')).toBe(String(SHOW_CLIPS_PAGE_SIZE));
      return new Response(
        JSON.stringify({
          clips: pages[page - 1],
          hasMore: page < pages.length,
        }),
      );
    }) as typeof fetch;

    let loaded: ClipWithUser[] = [];
    for (let page = 1, hasMore = true; hasMore; page += 1) {
      const result = await fetchShowClipsPage({
        artistName: 'phish',
        showId: 'jambase:15668773',
        sortBy: 'time_posted',
        page,
        fetchImpl,
      });
      loaded = appendUniqueShowClips(loaded, result.clips);
      hasMore = result.hasMore;
    }

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(loaded).toHaveLength(41);
    expect(loaded.some(({ id }) => id === 210)).toBe(true);
  });

  it('does not duplicate a clip repeated across page boundaries', () => {
    expect(appendUniqueShowClips([clip(1), clip(2)], [clip(2), clip(3)]).map(({ id }) => id))
      .toEqual([1, 2, 3]);
  });
});
