import { useEffect, useState } from 'react';
import { apiJson } from '@/src/lib/api/client';
import { apiArtistPath } from '@shared/app-paths';
import { merchUrlFromArtistSocialLinks } from '@shared/artist-merch-url';

type State = {
  imageUrl: string | null;
  websiteUrl: string | null;
  loading: boolean;
};

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
          artist?: { image_url?: string | null; social_links?: string | Record<string, unknown> | null };
        }>(path);
        if (cancelled) return;
        const img =
          typeof data.artist?.image_url === 'string'
            ? data.artist.image_url.trim()
            : '';
        setImageUrl(img || null);
        setWebsiteUrl(merchUrlFromArtistSocialLinks(data.artist?.social_links));
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
