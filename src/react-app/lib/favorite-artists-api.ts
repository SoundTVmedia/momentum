import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';

function normalizeArtistName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Load favorite artist display names (table + profile JSON). */
export async function loadFavoriteArtistNames(): Promise<string[]> {
  const names = new Set<string>();

  const [favRes, meRes] = await Promise.all([
    apiFetch('/api/users/me/favorite-artists', { cache: 'no-store' }),
    apiFetch('/api/users/me', { cache: 'no-store' }),
  ]);

  if (favRes.ok) {
    const data = (await favRes.json()) as { artists?: { name?: string | null }[] };
    for (const a of data.artists ?? []) {
      const n = typeof a.name === 'string' ? a.name.trim() : '';
      if (n) names.add(n);
    }
  }

  if (meRes.ok) {
    const me = (await meRes.json()) as {
      profile?: { favorite_artists?: string | null } | null;
    } | null;
    const json = me?.profile?.favorite_artists;
    if (json) {
      try {
        const parsed = JSON.parse(json) as unknown;
        if (Array.isArray(parsed)) {
          for (const x of parsed) {
            const n = typeof x === 'string' ? x.trim() : String(x ?? '').trim();
            if (n) names.add(n);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return [...names];
}

/** Persist favorites via personalization (same as home feed + profile editor). */
export async function saveFavoriteArtistNames(names: string[]): Promise<void> {
  const normalized = [
    ...new Set(names.map((n) => normalizeArtistName(n)).filter(Boolean)),
  ].slice(0, 25);

  const res = await apiFetch('/api/personalization/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      favorite_artists: normalized,
      personalization_enabled: true,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(body.detail || body.error || 'Could not save favorite artists');
  }
}

export async function addFavoriteArtistName(name: string): Promise<void> {
  const trimmed = normalizeArtistName(name);
  if (!trimmed) {
    throw new Error('Artist name is required');
  }
  const current = await loadFavoriteArtistNames();
  const key = trimmed.toLowerCase();
  if (current.some((n) => n.toLowerCase() === key)) return;
  await saveFavoriteArtistNames([...current, trimmed]);
}

export async function removeFavoriteArtistName(name: string): Promise<void> {
  const trimmed = normalizeArtistName(name);
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  const next = (await loadFavoriteArtistNames()).filter((n) => n.toLowerCase() !== key);
  await saveFavoriteArtistNames(next);
}

/** Additive follow by display name (does not replace the rest of the list). */
export async function followArtistByName(name: string): Promise<void> {
  const trimmed = normalizeArtistName(name);
  if (!trimmed) {
    throw new Error('Artist name is required');
  }
  const res = await apiFetch('/api/users/favorite-artists/sync-by-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names: [trimmed] }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(body.detail || body.error || 'Could not follow artist');
  }
}

export async function toggleFavoriteArtistByName(
  name: string,
  currentlyFollowing: boolean,
): Promise<boolean> {
  if (currentlyFollowing) {
    await removeFavoriteArtistName(name);
    return false;
  }
  await followArtistByName(name);
  return true;
}

export function favoriteArtistsErrorMessage(err: unknown): string {
  return apiFetchErrorMessage(err, 'Could not update favorite artists');
}
