import { clipPublishedNotificationContent } from '@/shared/notification-copy';

/** Best-effort local notification when a background upload finishes. */
export async function notifyClipUploadSuccess(
  displayName: string | null | undefined,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  const title = 'Feedback';
  const body = clipPublishedNotificationContent(displayName);

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }

  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      tag: `momentum-clip-posted-${Date.now()}`,
    });
  } catch (err) {
    console.warn('notifyClipUploadSuccess:', err);
  }
}
