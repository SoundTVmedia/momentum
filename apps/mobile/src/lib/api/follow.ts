import { apiJson } from '@/src/lib/api/client';

export async function fetchFollowingIds(): Promise<string[]> {
  const data = await apiJson<{ following_ids?: unknown }>('/api/users/me/following');
  return Array.isArray(data.following_ids)
    ? data.following_ids.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : [];
}

export async function toggleFollowTarget(
  target: string,
  body?: { artist_name?: string },
): Promise<{ following: boolean; artist_id?: number }> {
  return apiJson(`/api/users/${encodeURIComponent(target)}/follow`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function artistFollowTarget(artistId: number): string {
  return `artist-${artistId > 0 ? artistId : 0}`;
}

export function venueFollowTarget(venueId: number): string {
  return `venue-${venueId}`;
}
