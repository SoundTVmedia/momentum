import type { ClipWithUser } from '@/shared/types';

export type RelatedClipsScope = 'show' | 'artist';

export type RelatedClipsResponse = {
  clips: ClipWithUser[];
  scope: RelatedClipsScope;
};

/** Clips from the same show (when known) or same artist — for share-link modal swipe. */
export async function fetchRelatedClips(clipId: number): Promise<RelatedClipsResponse> {
  const res = await fetch(`/api/clips/${clipId}/related-clips`, { credentials: 'include' });
  if (!res.ok) {
    return { clips: [], scope: 'artist' };
  }
  const data = (await res.json()) as RelatedClipsResponse;
  return {
    clips: Array.isArray(data.clips) ? data.clips : [],
    scope: data.scope === 'show' ? 'show' : 'artist',
  };
}
