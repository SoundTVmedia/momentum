/** Share the Ticketmaster / primary ticketing URL for a show. */
export async function shareEventTickets(
  ticketUrl: string,
  eventTitle?: string,
): Promise<'shared' | 'copied' | 'cancelled'> {
  const title = eventTitle?.trim() || 'Concert tickets';
  const text = eventTitle?.trim()
    ? `Get tickets for ${eventTitle.trim()}`
    : 'Get tickets for this show';

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({ title, text, url: ticketUrl });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(ticketUrl);
    return 'copied';
  }

  window.open(ticketUrl, '_blank', 'noopener,noreferrer');
  return 'shared';
}
