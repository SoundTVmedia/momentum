/**
 * Stable-enough list key for clip rows. Always includes `index` so keys stay unique even if
 * `id` is duplicated, null, or missing (pagination overlap, API quirks).
 */
export function clipListItemKey(clip: { id?: unknown }, index: number): string {
  const raw = clip?.id;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return `clip-${raw}-i${index}`;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return `clip-${raw.trim()}-i${index}`;
  }
  return `clip-i${index}-noid`;
}
