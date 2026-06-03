import { describe, expect, it } from 'vitest';
import {
  applyMarkReadToNotifications,
  notificationKeysMatch,
} from './notification-ids';
import type { Notification } from '@/react-app/hooks/useNotifications';

function notif(partial: Partial<Notification> & Pick<Notification, 'id'>): Notification {
  return {
    rowId: partial.id,
    mocha_user_id: 'u1',
    type: 'like',
    content: 'liked your clip',
    related_user_id: 'u2',
    related_clip_id: 1,
    related_comment_id: null,
    is_read: 0,
    created_at: '2026-01-01T00:00:00Z',
    user_display_name: 'A',
    user_avatar: null,
    ...partial,
  };
}

describe('notification-ids', () => {
  it('marks read when id and rowId differ between list item and click target', () => {
    const list = [notif({ id: 5, rowId: 99, is_read: 0 })];
    const clicked = notif({ id: 99, rowId: 99 });
    expect(notificationKeysMatch(list[0], clicked)).toBe(true);
    const next = applyMarkReadToNotifications(list, clicked);
    expect(next[0].is_read).toBe(true);
  });
});
