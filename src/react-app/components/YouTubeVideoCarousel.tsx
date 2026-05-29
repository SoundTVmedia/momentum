import { useEffect, useState } from 'react';
import { loadYoutubeIframeApi } from '@/react-app/lib/youtube-iframe-api';
import { Link } from 'react-router';
import { Eye, Heart, Loader2, Play, Youtube } from 'lucide-react';
import { artistPath } from '@/shared/app-paths';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import YouTubeVideoModal, { type YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';
import SectionHeading from '@/react-app/components/SectionHeading';
import {
  PAGE_CAROUSEL_BLEED,
  YOUTUBE_CARD_ARTIST_SLOT_CLASS,
  YOUTUBE_CARD_BODY_CLASS,
  YOUTUBE_CARD_STATS_CLASS,
  YOUTUBE_CARD_THUMB_CLASS,
  YOUTUBE_CARD_TITLE_CLASS,
  YOUTUBE_CAROUSEL_CARD_CLASS,
} from '@/react-app/lib/homeFeedLayout';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function YouTubeVideoCard({
  video,
  onOpen,
  highlight = 'likes',
}: {
  video: YoutubeVideoItem;
  onOpen: (video: YoutubeVideoItem) => void;
  /** Which stat to show first on the card footer. */
  highlight?: 'likes' | 'views';
}) {
  const artistLabel = video.artistName?.trim();

  return (
    <div
      onClick={() => onOpen(video)}
      className={`glass-youtube-card group cursor-pointer ${YOUTUBE_CAROUSEL_CARD_CLASS} p-0 text-left`}
    >
      <div className={YOUTUBE_CARD_THUMB_CLASS}>
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
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg backdrop-blur-sm">
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </span>
        </div>
      </div>
      <div className={YOUTUBE_CARD_BODY_CLASS}>
        <p className={YOUTUBE_CARD_TITLE_CLASS}>{video.title}</p>
        {artistLabel ? (
          <Link
            to={artistPath(artistLabel)}
            onClick={(e) => e.stopPropagation()}
            className={`${YOUTUBE_CARD_ARTIST_SLOT_CLASS} relative z-10 block transition-colors hover:text-momentum-flare hover:underline`}
          >
            {artistLabel}
          </Link>
        ) : (
          <p className={YOUTUBE_CARD_ARTIST_SLOT_CLASS} aria-hidden>
            {'\u00A0'}
          </p>
        )}
        <div className={YOUTUBE_CARD_STATS_CLASS}>
          {highlight === 'views' ? (
            <>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatCount(video.viewCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {formatCount(video.likeCount)}
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {formatCount(video.likeCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatCount(video.viewCount)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export type YouTubeVideoCarouselProps = {
  videos: YoutubeVideoItem[];
  title: string;
  subtitle: string;
  ariaLabel: string;
  carouselClassName?: string;
  highlight?: 'likes' | 'views';
  loading?: boolean;
  emptyMessage?: string;
};

export default function YouTubeVideoCarousel({
  videos,
  title,
  subtitle,
  ariaLabel,
  carouselClassName = PAGE_CAROUSEL_BLEED,
  highlight = 'likes',
  loading = false,
  emptyMessage,
}: YouTubeVideoCarouselProps) {
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideoItem | null>(null);

  useEffect(() => {
    void loadYoutubeIframeApi();
  }, []);

  const openVideo = (item: YoutubeVideoItem) => {
    void loadYoutubeIframeApi();
    setSelectedVideo(item);
  };

  if (loading) {
    return (
      <div className="glass-youtube-card flex min-h-[17.75rem] items-center justify-center gap-2 p-8 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading YouTube…</span>
      </div>
    );
  }

  if (videos.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-sm text-gray-400">{emptyMessage}</p>;
  }

  return (
    <>
      <SectionHeading title={title} subtitle={subtitle} />

      <HorizontalClipCarousel
        ariaLabel={ariaLabel}
        className={carouselClassName}
        stretchItems
        filmstrip={false}
      >
        {videos.map((video) => (
          <HorizontalClipCarouselItem key={video.videoId}>
            <YouTubeVideoCard video={video} onOpen={openVideo} highlight={highlight} />
          </HorizontalClipCarouselItem>
        ))}
      </HorizontalClipCarousel>

      {selectedVideo ? (
        <YouTubeVideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          feedNavigation={
            videos.length > 1 ? { videos, onChangeVideo: setSelectedVideo } : null
          }
        />
      ) : null}
    </>
  );
}
