/** Badge label for alert icons — matches the Unread tab count in the notifications modal. */
export function formatNotificationBadgeCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export function hasUnreadNotifications(count: number): boolean {
  return count > 0;
}
