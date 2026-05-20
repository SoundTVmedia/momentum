import { useState } from 'react';
import { Eye, Heart, Loader2, Play, Youtube } from 'lucide-react';
import HorizontalClipCarousel, {
  HorizontalClipCarouselItem,
} from '@/react-app/components/HorizontalClipCarousel';
import YouTubeVideoModal, { type YoutubeVideoItem } from '@/react-app/components/YouTubeVideoModal';
import SectionHeading from '@/react-app/components/SectionHeading';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';

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
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className="video-card group flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 p-0 text-left transition-all hover:border-purple-500/50"
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
        <p className="line-clamp-2 text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">
          {video.title}
        </p>
        {video.artistName ? (
          <p className="mt-1 truncate text-xs text-cyan-300/90">{video.artistName}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-gray-400">
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
    </button>
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

  if (loading) {
    return (
      <div className="video-card flex items-center justify-center gap-2 border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-8 text-gray-400">
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

      <HorizontalClipCarousel ariaLabel={ariaLabel} className={carouselClassName}>
        {videos.map((video) => (
          <HorizontalClipCarouselItem key={video.videoId}>
            <YouTubeVideoCard video={video} onOpen={setSelectedVideo} highlight={highlight} />
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
