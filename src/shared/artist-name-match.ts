/** JamBase-style display name: trim, collapse spaces, Unicode NFC. */
export function normalizeArtistDisplayName(raw: string): string {
  let s = String(raw ?? '').trim().replace(/\s+/g, ' ');
  try {
    s = s.normalize('NFC');
  } catch {
    /* ignore */
  }
  return s;
}

function normalizedNameKey(name: string): string {
  return normalizeArtistDisplayName(name).toLowerCase();
}

/** True when ACR-identified artist matches the show headliner (exact or substring). */
export function headlinerMatchesAcrArtist(
  acrArtist: string,
  headlinerName: string | null | undefined,
): boolean {
  const a = normalizeArtistDisplayName(acrArtist);
  const h = normalizeArtistDisplayName(headlinerName ?? '');
  if (!a || !h) return false;
  const ak = normalizedNameKey(a);
  const hk = normalizedNameKey(h);
  if (ak === hk) return true;
  if (ak.includes(hk) || hk.includes(ak)) return true;
  return false;
}
