import { apiJson } from '@/src/lib/api/client';

export async function fetchLikedClipIds(): Promise<number[]> {
  const data = await apiJson<{ clip_ids?: number[]; liked_clip_ids?: number[] }>(
    '/api/users/me/liked-clips',
  );
  const ids = data.clip_ids ?? data.liked_clip_ids ?? [];
  return ids.filter((id): id is number => typeof id === 'number');
}

export async function fetchSavedClipIds(): Promise<number[]> {
  const data = await apiJson<{ clip_ids?: number[]; saved_clip_ids?: number[] }>(
    '/api/users/me/saved-clip-ids',
  );
  const ids = data.clip_ids ?? data.saved_clip_ids ?? [];
  return ids.filter((id): id is number => typeof id === 'number');
}

export async function toggleClipLike(
  clipId: number,
): Promise<{ liked: boolean; likes_count?: number }> {
  return apiJson(`/api/clips/${clipId}/like`, { method: 'POST' });
}

export async function toggleClipSave(
  clipId: number,
): Promise<{ saved: boolean }> {
  return apiJson(`/api/clips/${clipId}/save`, { method: 'POST' });
}
