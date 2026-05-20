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
