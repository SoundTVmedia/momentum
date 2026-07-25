import { describe, expect, it, vi } from 'vitest';
import type { ClipWithUser } from '@/shared/types';
import {
  appendUniqueShowClips,
  fetchAllShowClips,
  fetchShowClipsPage,
  SHOW_CLIPS_PAGE_SIZE,
} from './show-clips-pagination';

function clip(id: number): ClipWithUser {
  return { id } as ClipWithUser;
}

describe('show clips pagination', () => {
  it('automatically collects every clip across all API pages', async () => {
    const available = Array.from({ length: 53 }, (_, index) => clip(index + 1));
    const requestedPages: number[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input), 'https://example.com');
      const page = Number(url.searchParams.get('page'));
      const offset = (page - 1) * SHOW_CLIPS_PAGE_SIZE;
      requestedPages.push(page);
      expect(url.searchParams.get('limit')).toBe(String(SHOW_CLIPS_PAGE_SIZE));
      expect(url.searchParams.get('sort_by')).toBe('most_liked');
      expect(init?.signal).toBe(controller.signal);
      return new Response(
        JSON.stringify({
          clips: available.slice(offset, offset + SHOW_CLIPS_PAGE_SIZE),
          hasMore: offset + SHOW_CLIPS_PAGE_SIZE < available.length,
        }),
      );
    }) as typeof fetch;
    const controller = new AbortController();

    const loaded = await fetchAllShowClips({
      artistName: 'phish',
      showId: 'jambase:15668773',
      sortBy: 'most_liked',
      signal: controller.signal,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(requestedPages).toEqual([1, 2, 3]);
    expect(loaded.map(({ id }) => id)).toEqual(available.map(({ id }) => id));
  });

  it('does not duplicate a clip repeated across page boundaries', () => {
    expect(appendUniqueShowClips([clip(1), clip(2)], [clip(2), clip(3)]).map(({ id }) => id))
      .toEqual([1, 2, 3]);
  });

  it('passes aborts through and stops requesting later pages', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      throw new DOMException('The operation was aborted', 'AbortError');
    }) as typeof fetch;

    await expect(fetchAllShowClips({
      artistName: 'phish',
      showId: 'jambase:15668773',
      sortBy: 'time_posted',
      signal: controller.signal,
      fetchImpl,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('stops safely if an API page is empty despite claiming there is more', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      clips: [],
      hasMore: true,
    }))) as typeof fetch;

    await expect(fetchAllShowClips({
      artistName: 'phish',
      showId: 'jambase:15668773',
      sortBy: 'time_posted',
      fetchImpl,
    })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fetches a single page with the API page size', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toContain(`limit=${SHOW_CLIPS_PAGE_SIZE}`);
      return new Response(JSON.stringify({
        clips: [clip(1)],
        hasMore: false,
      }));
    });

    await fetchShowClipsPage({
      artistName: 'phish',
      showId: 'jambase:15668773',
      sortBy: 'time_posted',
      page: 1,
      fetchImpl: fetchMock as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
