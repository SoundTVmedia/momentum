/** In-app / push copy when a user's clip finishes publishing. */
export function clipPublishedNotificationContent(
  displayName: string | null | undefined,
): string {
  const name = (displayName ?? '').trim() || 'You';
  return `${name}, Your feedback clip is live.`;
}
