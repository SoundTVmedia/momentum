import { useEffect, useState } from 'react';
import { apiArtistPath } from '@/shared/app-paths';

type ClipArtistProfileState = {
  imageUrl: string | null;
  websiteUrl: string | null;
  loading: boolean;
};

function parseSocialLinksWebsite(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const v = JSON.parse(String(raw));
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const website = typeof v.website === 'string' ? v.website.trim() : '';
    if (!website) return null;
    const host = new URL(website).hostname.toLowerCase();
    if (host === 'jambase.com' || host.endsWith('.jambase.com')) return null;
    return website;
  } catch {
    return null;
  }
}

export function useClipArtistProfile(artistName?: string | null): ClipArtistProfileState {
  const artist = artistName?.trim() ?? '';
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        const res = await fetch(apiArtistPath(artist));
        if (!res.ok) return;
        const data = (await res.json()) as {
          artist?: { image_url?: string | null; social_links?: string | null };
        };
        if (cancelled) return;

        const img =
          typeof data.artist?.image_url === 'string' ? data.artist.image_url.trim() : '';
        setImageUrl(img || null);
        setWebsiteUrl(parseSocialLinksWebsite(data.artist?.social_links));
      } catch (err) {
        console.error('Clip artist profile:', err);
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
