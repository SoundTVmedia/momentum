/** Same-concert-night identity used to merge clips and library stubs. */
export function showNightKey(
  artistName: string | null | undefined,
  venueName: string | null | undefined,
  startDate: string | null | undefined,
): string | null {
  const artist = (artistName ?? '').trim().toLowerCase();
  const venue = (venueName ?? '')
    .trim()
    .replace(/['\u2019]/g, '')
    .toLowerCase();
  const ymd = (startDate ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  if (!artist || !venue || !ymd) return null;
  return `${artist}|${venue}|${ymd}`;
}
