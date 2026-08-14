/**
 * Song line for the quick-capture camera HUD, shown with the venue/show data.
 *
 * Sources, in priority order:
 * 1. Identified title for the just-queued clip (ShazamKit primary / ACRCloud
 *    fallback — patched onto the outbox job while it uploads).
 * 2. Stabilized live match while recording.
 * 3. A pending state while the queued clip's song ID is still running.
 */
export type CaptureHudLiveMatch = { artist: string; title: string };

export function resolveCaptureHudSongLabel(input: {
  identifiedTitle: string | null;
  liveMatch: CaptureHudLiveMatch | null;
  identifyPending: boolean;
}): string | null {
  const identified = input.identifiedTitle?.trim();
  if (identified) return `♪ ${identified}`;

  const liveTitle = input.liveMatch?.title.trim() ?? '';
  const liveArtist = input.liveMatch?.artist.trim() ?? '';
  if (liveTitle && liveArtist) return `♪ ${liveTitle} — ${liveArtist}`;
  if (liveTitle || liveArtist) return `♪ ${liveTitle || liveArtist}`;

  if (input.identifyPending) return 'Identifying song…';
  return null;
}

/** Song ID for the queued quick-capture clip is still in flight. */
export function isHudSongIdentifyPending(
  job: { songIdentifyPending?: boolean } | null | undefined,
  identifiedTitle: string | null,
): boolean {
  if (identifiedTitle?.trim()) return false;
  return Boolean(job && job.songIdentifyPending !== false);
}
