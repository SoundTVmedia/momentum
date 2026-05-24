/** Record a clip view (play or loop). Returns updated views_count from the server. */
export async function recordClipView(clipId: number): Promise<number | null> {
  if (!Number.isFinite(clipId) || clipId <= 0) return null;
  try {
    const res = await fetch(`/api/clips/${clipId}/view`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { views_count?: number };
    const n = data.views_count;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
