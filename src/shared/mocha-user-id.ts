/** Match worker `normalizeMochaUserIdKey` for ownership checks. */
export function normalizeMochaUserIdKey(v: string): string {
  return String(v).trim().toLowerCase();
}

export function clipBelongsToUser(
  viewerUserId: string | null | undefined,
  clipOwnerId: string | null | undefined,
): boolean {
  if (!viewerUserId?.trim() || clipOwnerId == null || clipOwnerId === '') return false;
  return normalizeMochaUserIdKey(viewerUserId) === normalizeMochaUserIdKey(String(clipOwnerId));
}

const NON_PROFILE_USER_IDS = new Set(['', 'deleted_user', 'anonymous', 'me']);

/** Trimmed mocha user id that can open `/users/:id`, or null if it is missing/placeholder. */
export function navigableMochaUserId(id: string | null | undefined): string | null {
  const v = String(id ?? '').trim();
  if (NON_PROFILE_USER_IDS.has(v.toLowerCase())) return null;
  return v;
}
