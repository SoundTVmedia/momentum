/** Stable positive integer clip id for API calls and comparisons. */
export function clipNumericId(clip: { id?: unknown }): number | null {
  const rec = clip as Record<string, unknown>;
  const raw = clip.id ?? rec.clip_primary_id ?? rec.clip_id ?? rec.ID ?? rec.clipId;
  if (typeof raw === 'bigint') {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    const n = Math.trunc(raw);
    if (n <= 0) return null;
    if (Math.abs(raw - n) < 1e-9) return n;
    return null;
  }
  if (typeof raw === 'string') {
    const t = String(raw).trim();
    if (/^\d+$/.test(t)) {
      const n = Number.parseInt(t, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const f = Number(t);
    if (Number.isFinite(f) && f > 0) {
      const n = Math.trunc(f);
      if (Math.abs(f - n) < 1e-9) return n;
    }
    return null;
  }
  return null;
}
