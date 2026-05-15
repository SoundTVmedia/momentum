/** Stable TEXT key for D1 `mocha_user_id` columns (Mocha may supply number or string). */
export function mochaUserIdKey(user: { id: unknown }): string {
  return String(user.id ?? '').trim();
}

/** Parse D1 `meta.last_row_id` (typed as number; may arrive as string at runtime). */
export function parseD1LastRowId(lid: unknown): number | null {
  if (lid == null || lid === '') return null;
  const n = typeof lid === 'number' ? lid : Number(lid);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}
