/** Stable localStorage / UI key for an artist without a DB id yet. */
export function artistNameFollowKey(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return `artist-name:${normalized}`;
}

/** Follow target for `/api/users/:userId/follow` (artist rows → favorite artists). */
export function artistFollowTarget(artistId: number, artistName: string): string {
  return artistId > 0 ? `artist-${artistId}` : artistNameFollowKey(artistName);
}

export function isArtistFollowTarget(target: string): boolean {
  return /^artist-\d+$/.test(target) || target.startsWith('artist-name:');
}
