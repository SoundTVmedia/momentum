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
