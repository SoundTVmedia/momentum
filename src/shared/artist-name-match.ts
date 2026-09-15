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

/** Exact or substring match after JamBase-style name normalization. */
export function displayNamesClose(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeArtistDisplayName(left ?? '');
  const b = normalizeArtistDisplayName(right ?? '');
  if (!a || !b) return false;
  const ak = normalizedNameKey(a);
  const hk = normalizedNameKey(b);
  if (ak === hk) return true;
  return ak.includes(hk) || hk.includes(ak);
}

/** True when ACR-identified artist matches the show headliner (exact or substring). */
export function headlinerMatchesAcrArtist(
  acrArtist: string,
  headlinerName: string | null | undefined,
): boolean {
  return displayNamesClose(acrArtist, headlinerName);
}
