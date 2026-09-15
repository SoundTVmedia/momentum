export type JamBaseSetlistSong = {
  title: string;
  artist?: string;
};

function songFromUnknown(value: unknown): JamBaseSetlistSong | null {
  if (typeof value === 'string' && value.trim()) {
    return { title: value.trim() };
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const nestedSong = row.song;
  if (nestedSong && typeof nestedSong === 'object') {
    const nested = songFromUnknown(nestedSong);
    if (nested) return nested;
  }
  const titleRaw =
    (typeof row.name === 'string' && row.name) ||
    (typeof row.title === 'string' && row.title) ||
    (typeof row.song === 'string' && row.song) ||
    '';
  const title = titleRaw.trim();
  if (!title) return null;

  const byArtist = row.byArtist;
  let artist: string | undefined;
  if (byArtist && typeof byArtist === 'object') {
    const name = (byArtist as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim()) artist = name.trim();
  } else if (typeof row.artist === 'string' && row.artist.trim()) {
    artist = row.artist.trim();
  }

  return artist ? { title, artist } : { title };
}

function pushSongs(bucket: unknown, out: JamBaseSetlistSong[], seen: Set<string>): void {
  const items = Array.isArray(bucket) ? bucket : bucket != null ? [bucket] : [];
  for (const item of items) {
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      if (Array.isArray(row.set) || Array.isArray(row.song) || Array.isArray(row.songs)) {
        pushSongs(row.set ?? row.song ?? row.songs, out, seen);
        continue;
      }
    }
    const song = songFromUnknown(item);
    if (!song) continue;
    const key = `${(song.artist ?? '').toLowerCase()}|${song.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(song);
  }
}

/** Best-effort setlist from a JamBase event payload when the API includes songs. */
export function jamBaseEventSetlist(ev: Record<string, unknown> | null | undefined): JamBaseSetlistSong[] {
  if (!ev) return [];
  const out: JamBaseSetlistSong[] = [];
  const seen = new Set<string>();
  const buckets = [
    ev.setlist,
    ev['x-setlist'],
    ev.workPerformed,
    ev.recordedAs,
    ev.songs,
    ev.song,
  ];
  for (const bucket of buckets) {
    pushSongs(bucket, out, seen);
  }
  const performer = ev.performer;
  if (Array.isArray(performer)) {
    for (const p of performer) {
      if (p && typeof p === 'object') {
        const row = p as Record<string, unknown>;
        pushSongs(row.setlist ?? row['x-setlist'] ?? row.workPerformed, out, seen);
      }
    }
  }
  return out;
}

/** setlist.fm (or similar) URL from JamBase `sameAs` links, if present. */
export function jamBaseEventSetlistUrl(ev: Record<string, unknown> | null | undefined): string | null {
  if (!ev) return null;
  const sameAs = ev.sameAs;
  if (!Array.isArray(sameAs)) return null;
  for (const row of sameAs) {
    if (!row || typeof row !== 'object') continue;
    const url = typeof (row as Record<string, unknown>).url === 'string'
      ? ((row as Record<string, unknown>).url as string).trim()
      : '';
    if (/setlist\.fm/i.test(url)) return url;
  }
  return null;
}

export type StoredSetlist = {
  songs: JamBaseSetlistSong[];
  url: string | null;
  /** True after we already tried the JamBase show-page HTML. */
  htmlChecked?: boolean;
};

/** JSON we persist on `library_shows` / `jambase_events.setlist_json`. */
export function serializeStoredSetlist(
  ev: Record<string, unknown>,
  htmlChecked = false,
): string | null {
  const songs = jamBaseEventSetlist(ev);
  if (songs.length === 0 && !htmlChecked) return null;
  return JSON.stringify({ songs, url: null, htmlChecked });
}

export function parseStoredSetlist(raw: string | null | undefined): StoredSetlist {
  if (!raw?.trim()) return { songs: [], url: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        songs: parsed.map(songFromUnknown).filter((s): s is JamBaseSetlistSong => s != null),
        url: null,
      };
    }
    if (parsed && typeof parsed === 'object') {
      const row = parsed as Record<string, unknown>;
      const songs = Array.isArray(row.songs)
        ? row.songs.map(songFromUnknown).filter((s): s is JamBaseSetlistSong => s != null)
        : [];
      const url =
        typeof row.url === 'string' && row.url.trim() && !/setlist\.fm/i.test(row.url)
          ? row.url.trim()
          : null;
      const htmlChecked = row.htmlChecked === true;
      return { songs, url, htmlChecked };
    }
  } catch {
    /* ignore malformed cache rows */
  }
  return { songs: [], url: null };
}

export function setlistFromStoredEvent(
  setlistJson: string | null | undefined,
  payload: Record<string, unknown> | null | undefined,
): StoredSetlist {
  const stored = parseStoredSetlist(setlistJson);
  if (stored.songs.length > 0 || stored.url || stored.htmlChecked) return stored;
  if (!payload) return { songs: [], url: null };
  return {
    songs: jamBaseEventSetlist(payload),
    url: null,
    htmlChecked: false,
  };
}

export type StoredShowPage = {
  event: Record<string, unknown>;
  setlist: JamBaseSetlistSong[];
  setlist_url: string | null;
  htmlChecked: boolean;
};

/** Stamp extracted songs onto a cached event so client parsers keep working. */
export function applyStoredSetlistToEvent(
  event: Record<string, unknown>,
  stored: StoredSetlist,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...event };
  if (stored.songs.length > 0) next['x-setlist'] = stored.songs;
  if (stored.url) {
    const sameAs = Array.isArray(event.sameAs) ? [...event.sameAs] : [];
    const already = sameAs.some(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof (row as Record<string, unknown>).url === 'string' &&
        ((row as Record<string, unknown>).url as string).trim() === stored.url,
    );
    if (!already) sameAs.push({ url: stored.url });
    next.sameAs = sameAs;
  }
  return next;
}
