import { useEffect, useState } from 'react';
import { Eye, Heart, Loader2, Play, Youtube } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import YouTubeVideoModal, { type YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';
import { apiFetch } from '@/react-app/lib/apiFetch';
import {
  HOME_FEED_CAROUSEL_BLEED,
  HOME_FEED_SECTION_CLASS,
  MOBILE_CAROUSEL_ITEM_PEEK_CLASS,
  PAGE_CAROUSEL_BLEED,
} from '@/react-app/lib/homeFeedLayout';

export type { YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';

type YoutubeVideosResponse = {
  configured?: boolean;
  message?: string;
  mostLiked?: YoutubeVideoItem[];
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function YouTubeVideoCard({
  video,
  onOpen,
}: {
  video: YoutubeVideoItem;
  onOpen: (video: YoutubeVideoItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className={`group flex h-full min-h-[18rem] w-full flex-col overflow-hidden rounded-xl border border-red-500/25 bg-black/40 backdrop-blur-lg text-left transition-colors hover:border-red-400/50 ${MOBILE_CAROUSEL_ITEM_PEEK_CLASS}`}
    >
      <div className="relative aspect-video shrink-0 overflow-hidden bg-white/5">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500" aria-hidden>
            <Youtube className="h-12 w-12 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg">
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-sm font-semibold text-white group-hover:text-red-200">
          {video.title}
        </p>
        <p className="mt-1 truncate text-xs text-cyan-300/90">{video.artistName}</p>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {formatCount(video.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {formatCount(video.viewCount)}
          </span>
        </div>
      </div>
    </button>
  );
}

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
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideoItem | null>(null);

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
        const res = await apiFetch('/api/youtube/favorite-artist-videos?limit=6', {
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
  const hasVideos = mostLiked.length > 0;

  const sectionHeader = (
    <div className="mb-4 md:mb-5">
      <h2 className="text-xl sm:text-2xl font-bold momentum-grad-text">On YouTube</h2>
      <p className="mt-1 text-sm text-gray-400">
        Most liked videos from artists you follow
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        {sectionHeader}
        <div className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-black/40 p-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading YouTube picks…</span>
        </div>
      </div>
    );
  }

  if (!payload?.configured) {
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        {sectionHeader}
        <p className="text-sm text-gray-400">
          {payload?.message ??
            'YouTube API key is not loaded on the worker. Add YOUTUBE_API_KEY to .dev.vars (local) or Wrangler secrets (production), then restart.'}
        </p>
      </div>
    );
  }

  if (!hasVideos) {
    const msg = payload?.message ?? 'No YouTube videos found for your favorite artists yet.';
    const isNoFavorites = msg === 'No favorite artists set';
    return (
      <div className={HOME_FEED_SECTION_CLASS}>
        {sectionHeader}
        <p className="text-sm text-gray-400">
          {isNoFavorites
            ? 'Add favorite artists to see their most liked videos here.'
            : msg}
        </p>
      </div>
    );
  }

  return (
    <section className={HOME_FEED_SECTION_CLASS}>
      {sectionHeader}

      <HorizontalClipCarousel
        stretchItems
        ariaLabel="Most liked YouTube videos from your favorite artists"
        className={carouselBleed}
      >
        {mostLiked.map((video) => (
          <HorizontalClipCarouselItem key={video.videoId} className="md:w-80 lg:w-96">
            <YouTubeVideoCard video={video} onOpen={setSelectedVideo} />
          </HorizontalClipCarouselItem>
        ))}
      </HorizontalClipCarousel>

      {selectedVideo ? (
        <YouTubeVideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          feedNavigation={
            mostLiked.length > 1
              ? { videos: mostLiked, onChangeVideo: setSelectedVideo }
              : null
          }
        />
      ) : null}
    </section>
  );
}
