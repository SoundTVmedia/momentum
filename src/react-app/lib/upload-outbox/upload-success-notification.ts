export function clipUploadNotificationLabel(input: {
  artist_name?: string;
  venue_name?: string;
}): string {
  return input.artist_name?.trim() || input.venue_name?.trim() || 'Your clip';
}

/** Best-effort local notification when a background upload finishes. */
export async function notifyClipUploadSuccess(label: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  const title = 'Clip posted';
  const body = `${label} is live on Feedback.`;

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
