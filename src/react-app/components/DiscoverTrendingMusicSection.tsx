import { useEffect, useState } from 'react';
import YouTubeVideoCarousel from '@/react-app/components/YouTubeVideoCarousel';
import type { YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { HOME_FEED_SECTION_CLASS, PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

type TrendingMusicResponse = {
  configured?: boolean;
  videos?: YoutubeVideoItem[];
  message?: string;
};

export default function DiscoverTrendingMusicSection() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [videos, setVideos] = useState<YoutubeVideoItem[]>([]);
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/youtube/trending-music?limit=16', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as TrendingMusicResponse;
          setConfigured(data.configured !== false);
          setVideos(data.videos ?? []);
          setMessage(data.message);
        } else {
          setConfigured(false);
          setVideos([]);
        }
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (!loading && !configured) {
    return null;
  }

  if (!loading && videos.length === 0 && !message) {
    return null;
  }

  return (
    <section className={HOME_FEED_SECTION_CLASS}>
      <YouTubeVideoCarousel
        videos={videos}
        title="Trending on YouTube"
        subtitle="Popular music videos right now"
        ariaLabel="Trending music on YouTube"
        carouselClassName={PAGE_CAROUSEL_BLEED}
        highlight="views"
        loading={loading}
        emptyMessage={message}
      />
    </section>
  );
}
