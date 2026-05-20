import { useEffect, useState } from 'react';
import YouTubeVideoCarousel from '@/react-app/components/YouTubeVideoCarousel';
import type { YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';
import { apiArtistYoutubeVideosPath } from '@/shared/app-paths';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

type ArtistYoutubeResponse = {
  configured?: boolean;
  message?: string;
  mostViewed?: YoutubeVideoItem[];
};

export type ArtistYouTubeSectionProps = {
  artistName: string;
};

export default function ArtistYouTubeSection({ artistName }: ArtistYouTubeSectionProps) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [mostViewed, setMostViewed] = useState<YoutubeVideoItem[]>([]);
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    const path = apiArtistYoutubeVideosPath(artistName);
    if (!path) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${path}?limit=8`, { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as ArtistYoutubeResponse;
          setConfigured(data.configured !== false);
          setMostViewed(data.mostViewed ?? []);
          setMessage(data.message);
        } else {
          setConfigured(false);
          setMostViewed([]);
        }
      } catch {
        setMostViewed([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [artistName]);

  if (!loading && !configured) {
    return null;
  }

  if (!loading && mostViewed.length === 0 && !message) {
    return null;
  }

  return (
    <div className="mb-8">
      <YouTubeVideoCarousel
        videos={mostViewed}
        title="On YouTube"
        subtitle="Most viewed videos"
        ariaLabel={`Most viewed YouTube videos for ${artistName}`}
        carouselClassName={PAGE_CAROUSEL_BLEED}
        highlight="views"
        loading={loading}
        emptyMessage={message}
      />
    </div>
  );
}
