/** In-app / push copy when a user's clip finishes publishing. */
export function clipPublishedNotificationContent(
  displayName: string | null | undefined,
): string {
  const name = (displayName ?? '').trim() || 'You';
  return `${name}, Your feedback clip is live.`;
}

/** Owner prompt when their published clip cannot be decoded. */
export function clipNeedsReuploadNotificationContent(
  displayName: string | null | undefined,
): string {
  const name = (displayName ?? '').trim() || 'You';
  return `${name}, this clip cannot be played. Re-upload the video so it can show in feeds again.`;
}
