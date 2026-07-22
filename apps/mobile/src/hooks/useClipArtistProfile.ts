import { useEffect, useState } from 'react';
import { apiJson } from '@/src/lib/api/client';
import { apiArtistPath } from '@shared/app-paths';

type State = {
  imageUrl: string | null;
  websiteUrl: string | null;
  loading: boolean;
};

function parseSocialLinksWebsite(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const v = JSON.parse(String(raw)) as unknown;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const website =
      typeof (v as { website?: unknown }).website === 'string'
        ? (v as { website: string }).website.trim()
        : '';
    if (!website) return null;
    const host = new URL(website).hostname.toLowerCase();
    if (host === 'jambase.com' || host.endsWith('.jambase.com')) return null;
    return website;
  } catch {
    return null;
  }
}

export function useClipArtistProfile(artistName?: string | null): State {
  const artist = artistName?.trim() ?? '';
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(artist));

  useEffect(() => {
    if (!artist) {
      setImageUrl(null);
      setWebsiteUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setImageUrl(null);
      setWebsiteUrl(null);
      try {
        const path = apiArtistPath(artist);
        if (!path) return;
        const data = await apiJson<{
          artist?: { image_url?: string | null; social_links?: string | null };
        }>(path);
        if (cancelled) return;
        const img =
          typeof data.artist?.image_url === 'string'
            ? data.artist.image_url.trim()
            : '';
        setImageUrl(img || null);
        setWebsiteUrl(parseSocialLinksWebsite(data.artist?.social_links));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artist]);

  return { imageUrl, websiteUrl, loading };
}
