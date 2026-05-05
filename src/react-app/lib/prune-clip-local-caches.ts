/** Remove a clip id from liked/saved id lists in localStorage (best-effort). */
export function pruneClipFromLocalCaches(clipId: number, userId: string) {
  try {
    for (const key of [`liked_clips_${userId}`, `saved_clips_${userId}`]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw) as number[];
      if (!Array.isArray(arr)) continue;
      const next = arr.filter((id) => id !== clipId);
      if (next.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
}
