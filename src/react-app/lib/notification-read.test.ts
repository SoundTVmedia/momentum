import { describe, expect, it } from 'vitest';
import { isNotificationUnread } from './notification-read';

describe('isNotificationUnread', () => {
  it('treats 0, false, and null as unread', () => {
    expect(isNotificationUnread(0)).toBe(true);
    expect(isNotificationUnread(false)).toBe(true);
    expect(isNotificationUnread(null)).toBe(true);
    expect(isNotificationUnread('0')).toBe(true);
  });

  it('treats 1 and true as read', () => {
    expect(isNotificationUnread(1)).toBe(false);
    expect(isNotificationUnread(true)).toBe(false);
    expect(isNotificationUnread('1')).toBe(false);
  });
});
