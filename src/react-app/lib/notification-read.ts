/** D1/SQLite may return 0/1, boolean, or string for `is_read`. */
export function isNotificationUnread(isRead: unknown): boolean {
  if (isRead === 0 || isRead === false) return true;
  if (isRead === 1 || isRead === true) return false;
  if (typeof isRead === 'string') {
    const s = isRead.trim().toLowerCase();
    if (s === '0' || s === 'false') return true;
    if (s === '1' || s === 'true') return false;
  }
  return !isRead;
}
