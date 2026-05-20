import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { X, Heart, Eye, ChevronLeft, ChevronRight, ExternalLink, Music } from 'lucide-react';
import { useHorizontalFeedSwipe } from '@/react-app/hooks/useHorizontalFeedSwipe';
import { artistPath } from '@/shared/app-paths';
export type YoutubeVideoItem = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  channelTitle: string;
  artistName: string;
  watchUrl: string;
};

export type YouTubeVideoModalFeedNavigation = {
  videos: YoutubeVideoItem[];
  onChangeVideo: (video: YoutubeVideoItem) => void;
};

export type YouTubeVideoModalProps = {
  video: YoutubeVideoItem;
  onClose: () => void;
  feedNavigation?: YouTubeVideoModalFeedNavigation | null;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export default function YouTubeVideoModal({
  video,
  onClose,
  feedNavigation = null,
}: YouTubeVideoModalProps) {
  const navigate = useNavigate();

  const navIndex =
    feedNavigation && feedNavigation.videos.length > 0
      ? feedNavigation.videos.findIndex((v) => v.videoId === video.videoId)
      : -1;
  const canFeedNav = navIndex >= 0 && feedNavigation != null && feedNavigation.videos.length > 1;
  const prevVideo =
    canFeedNav && navIndex > 0 ? feedNavigation!.videos[navIndex - 1] : null;
  const nextVideo =
    canFeedNav && navIndex < feedNavigation!.videos.length - 1
      ? feedNavigation!.videos[navIndex + 1]
      : null;

  const goPrev = useCallback(() => {
    if (prevVideo && feedNavigation) feedNavigation.onChangeVideo(prevVideo);
  }, [prevVideo, feedNavigation]);

  const goNext = useCallback(() => {
    if (nextVideo && feedNavigation) feedNavigation.onChangeVideo(nextVideo);
  }, [nextVideo, feedNavigation]);

  const [mobileViewport, setMobileViewport] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const mobileSwipeEnabled = canFeedNav && mobileViewport;

  const { containerRef: mobileSwipeRef } = useHorizontalFeedSwipe({
    enabled: mobileSwipeEnabled,
    onPrev: goPrev,
    onNext: goNext,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!canFeedNav) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canFeedNav, goPrev, goNext, onClose]);

  const embedSrc = `https://www.youtube.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&rel=0`;

  const goArtistPage = () => {
    if (!video.artistName?.trim()) return;
    onClose();
    navigate(artistPath(video.artistName));
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div
        ref={mobileSwipeRef}
        className="max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] bg-black/95 border-0 sm:border border-momentum-teal/20 sm:rounded-xl overflow-hidden animate-scale-in"
      >
        <div className="flex flex-col md:flex-row h-full sm:max-h-[90vh]">
          <div className="md:w-2/3 bg-black flex items-center justify-center relative flex-shrink-0 min-h-[36vh] md:min-h-0 p-2 sm:p-4">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {prevVideo ? (
              <button
                type="button"
                onClick={goPrev}
                className="hidden md:flex absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/55 hover:bg-black/75 text-white border border-white/15 transition-colors"
                aria-label="Previous video"
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            ) : null}
            {nextVideo ? (
              <button
                type="button"
                onClick={goNext}
                className="hidden md:flex absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/55 hover:bg-black/75 text-white border border-white/15 transition-colors"
                aria-label="Next video"
              >
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            ) : null}

            <div className="relative mx-auto aspect-video w-full max-h-[min(85dvh,100%)] overflow-hidden rounded-none bg-black sm:rounded-lg md:max-h-[min(90vh,72vw)]">
              <iframe
                key={video.videoId}
                title={video.title}
                src={embedSrc}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              {mobileSwipeEnabled ? (
                <div
                  className="absolute inset-0 z-10 touch-none"
                  aria-hidden
                  tabIndex={-1}
                />
              ) : null}
            </div>
          </div>

          <div className="md:w-1/3 flex flex-col bg-slate-900/50 flex-1 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-white/10 flex-shrink-0">
              <p className="text-xs uppercase tracking-wide text-red-400/90 font-medium mb-2">
                YouTube
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">{video.title}</h2>
              {video.artistName ? (
                <button
                  type="button"
                  onClick={goArtistPage}
                  className="mt-2 inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                >
                  <Music className="h-4 w-4 shrink-0 text-purple-400" />
                  <span className="truncate">{video.artistName}</span>
                </button>
              ) : null}
              {video.channelTitle ? (
                <p className="mt-1 text-gray-400 text-sm truncate">{video.channelTitle}</p>
              ) : null}
            </div>

            <div className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-400" />
                  {formatCount(video.likeCount)} likes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-gray-400" />
                  {formatCount(video.viewCount)} views
                </span>
              </div>

              {video.publishedAt ? (
                <p className="text-xs text-gray-500">
                  Published{' '}
                  {new Date(video.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              ) : null}
            </div>

            <div className="p-3 sm:p-4 border-t border-white/10 flex-shrink-0">
              <a
                href={video.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
              >
                <span>Open on YouTube</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
