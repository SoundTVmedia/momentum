export const USER_BLOCKS_CHANGED_EVENT = 'user-blocks-changed';

export type UserBlocksChangedDetail = {
  userId: string;
  blocked: boolean;
};

function normalizedUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

export function dispatchUserBlocksChanged(userId: string, blocked: boolean): void {
  const normalized = normalizedUserId(userId);
  if (!normalized) return;

  window.dispatchEvent(
    new CustomEvent<UserBlocksChangedDetail>(USER_BLOCKS_CHANGED_EVENT, {
      detail: { userId: normalized, blocked },
    }),
  );
}

export function userBlocksChangedDetail(event: Event): UserBlocksChangedDetail | null {
  const detail = (event as CustomEvent<Partial<UserBlocksChangedDetail>>).detail;
  const userId = typeof detail?.userId === 'string' ? normalizedUserId(detail.userId) : '';
  if (!userId || typeof detail?.blocked !== 'boolean') return null;
  return { userId, blocked: detail.blocked };
}
