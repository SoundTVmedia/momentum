/** Whole-star rating for a show or clip (1–5). */
export function parseStarRating(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}
