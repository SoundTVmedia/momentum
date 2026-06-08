import { useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import YouTubeVideoCarousel from '@/react-app/components/YouTubeVideoCarousel';
import type { YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';
import { apiFetch } from '@/react-app/lib/apiFetch';
import {
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

export type { YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';

type YoutubeVideosResponse = {
  configured?: boolean;
  message?: string;
  mostLiked?: YoutubeVideoItem[];
};

export type FavoriteArtistYouTubeSectionProps = {
  carouselBleedScope?: 'home' | 'page';
};

export default function FavoriteArtistYouTubeSection({
  carouselBleedScope = 'page',
}: FavoriteArtistYouTubeSectionProps) {
  const { user, isPending: authPending } = useAuth();
  const carouselBleed =
    carouselBleedScope === 'page' ? PAGE_CAROUSEL_BLEED : HOME_FEED_CAROUSEL_BLEED;

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<YoutubeVideosResponse | null>(null);

  useEffect(() => {
    if (authPending) return;
    if (!user) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/youtube/favorite-artist-videos?limit=20', {
          cache: 'no-store',
        });
        if (res.ok) {
          setPayload((await res.json()) as YoutubeVideosResponse);
        } else {
          let message = 'Could not load YouTube videos.';
          try {
            const errBody = (await res.json()) as { error?: string; message?: string };
            message = errBody.error ?? errBody.message ?? message;
          } catch {
            /* ignore */
          }
          setPayload({ configured: true, mostLiked: [], message });
        }
      } catch {
        setPayload({
          configured: true,
          mostLiked: [],
          message: 'Could not reach the API. Restart the worker if developing locally.',
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user, authPending]);

  if (!user) return null;

  const mostLiked = payload?.mostLiked ?? [];

  if (!loading && !payload?.configured) {
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        <p className="text-sm text-gray-400">
          {payload?.message ??
            'YouTube API key is not loaded on the worker. Add YOUTUBE_API_KEY to .dev.vars (local) or Wrangler secrets (production), then restart.'}
        </p>
      </div>
    );
  }

  if (!loading && mostLiked.length === 0) {
    const msg = payload?.message ?? 'No YouTube videos found for your favorite artists yet.';
    const isNoFavorites = msg === 'No favorite artists set';
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        <div className="mb-4 md:mb-5">
          <h2 className="fb-section-title">Your Artists on YouTube</h2>
          <p className="mt-1 text-sm text-gray-400">
            {isNoFavorites
              ? 'Add favorite artists to see their most liked videos here.'
              : msg}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className={HOME_FEED_SECTION_CLASS}>
      <YouTubeVideoCarousel
        videos={mostLiked}
        title="Your Artists on YouTube"
        subtitle="Most liked videos from artists you follow"
        ariaLabel="Most liked YouTube videos from your favorite artists"
        carouselClassName={carouselBleed}
        highlight="likes"
        loading={loading}
      />
    </section>
  );
}
