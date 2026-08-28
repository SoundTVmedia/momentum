import { useEffect, useState } from 'react';
import { apiArtistPath } from '@/shared/app-paths';
import { merchUrlFromArtistSocialLinks } from '@/shared/artist-merch-url';
import { displayMediaUrl } from '@/shared/media-proxy';

type ClipArtistProfileState = {
  imageUrl: string | null;
  websiteUrl: string | null;
  loading: boolean;
};

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
          artist?: { image_url?: string | null; social_links?: string | Record<string, unknown> | null };
        };
        if (cancelled) return;

        const img =
          typeof data.artist?.image_url === 'string' ? data.artist.image_url.trim() : '';
        setImageUrl(img ? displayMediaUrl(img) : null);
        setWebsiteUrl(merchUrlFromArtistSocialLinks(data.artist?.social_links));
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
