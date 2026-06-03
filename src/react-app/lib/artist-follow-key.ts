/** Stable localStorage / UI key for an artist without a DB id yet. */
export function artistNameFollowKey(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return `artist-name:${normalized}`;
}

/** API path segment for artist follow (`artist-0` + `artist_name` body when id unknown). */
export function artistFollowApiTarget(artistId: number): string {
  return `artist-${artistId > 0 ? artistId : 0}`;
}

/** Follow target for `/api/users/:userId/follow` (artist rows → favorite artists). */
export function artistFollowTarget(artistId: number, _artistName?: string): string {
  return artistFollowApiTarget(artistId);
}

export function isArtistFollowTarget(target: string): boolean {
  return /^artist-\d+$/.test(target) || target.startsWith('artist-name:');
}

export function parseArtistIdFromFollowTarget(target: string): number {
  const m = /^artist-(\d+)$/.exec(target);
  if (!m) return 0;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : 0;
}

/** All local/API keys used to track follow state for one artist. */
export function artistFollowStateKeys(artistId: number, artistName?: string): string[] {
  const keys = new Set<string>();
  if (artistId > 0) keys.add(`artist-${artistId}`);
  keys.add(artistFollowApiTarget(artistId));
  const trimmed = artistName?.trim();
  if (trimmed) keys.add(artistNameFollowKey(trimmed));
  return [...keys];
}
