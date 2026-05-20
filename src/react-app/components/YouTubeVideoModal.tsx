import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  X,
  Heart,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Music,
  Play,
} from 'lucide-react';
import { useHorizontalFeedSwipe } from '@/react-app/hooks/useHorizontalFeedSwipe';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
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

function youtubeEmbedSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  });
  if (typeof window !== 'undefined') {
    params.set('origin', window.location.origin);
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function YouTubeEmbed({
  video,
  embedActive,
  onActivateEmbed,
  edgeSwipeHandlers,
}: {
  video: YoutubeVideoItem;
  embedActive: boolean;
  onActivateEmbed: () => void;
  edgeSwipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}) {
  return (
    <div className="relative h-full w-full min-h-0 bg-black">
      {embedActive ? (
        <iframe
          key={video.videoId}
          title={video.title}
          src={youtubeEmbedSrc(video.videoId)}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={onActivateEmbed}
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-black"
          aria-label={`Play ${video.title}`}
        >
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-80"
            />
          ) : null}
          <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-red-600/95 text-white shadow-lg">
            <Play className="ml-1 h-8 w-8 fill-current" />
          </span>
          <span className="relative z-10 mt-3 text-sm font-medium text-white/90">Tap to play</span>
        </button>
      )}
      {edgeSwipeHandlers ? (
        <>
          <div
            className="absolute bottom-0 left-0 top-0 z-20 w-[20%] max-w-[4.5rem]"
            aria-hidden
            onTouchStart={edgeSwipeHandlers.onTouchStart}
            onTouchEnd={edgeSwipeHandlers.onTouchEnd}
          />
          <div
            className="absolute bottom-0 right-0 top-0 z-20 w-[20%] max-w-[4.5rem]"
            aria-hidden
            onTouchStart={edgeSwipeHandlers.onTouchStart}
            onTouchEnd={edgeSwipeHandlers.onTouchEnd}
          />
        </>
      ) : null}
    </div>
  );
}

function YouTubeModalSidebar({
  video,
  goArtistPage,
}: {
  video: YoutubeVideoItem;
  goArtistPage: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden bg-slate-900/50 md:w-1/3">
      <div className="flex-shrink-0 border-b border-white/10 p-3 sm:p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-400/90">
          YouTube
        </p>
        <h2 className="text-lg font-bold leading-snug text-white sm:text-xl">{video.title}</h2>
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
          <p className="mt-1 truncate text-sm text-gray-400">{video.channelTitle}</p>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-red-400" />
            {formatCount(video.likeCount)} likes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-gray-400" />
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

      <div className="flex-shrink-0 border-t border-white/10 p-3 sm:p-4">
        <a
          href={video.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/90 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
        >
          <span>Open on YouTube</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export default function YouTubeVideoModal({
  video,
  onClose,
  feedNavigation = null,
}: YouTubeVideoModalProps) {
  const navigate = useNavigate();
  const { setHideBottomNav } = useMobileChrome();

  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

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

  /** Card open is a user gesture; keep true so the embed can autoplay on mobile when allowed. */
  const [mobileEmbedActive, setMobileEmbedActive] = useState(true);

  const mobileSwipeEnabled = canFeedNav && mobileViewport;

  const { containerRef: mobileSwipeRef, onTouchStart, onTouchEnd } = useHorizontalFeedSwipe({
    enabled: mobileSwipeEnabled,
    onPrev: goPrev,
    onNext: goNext,
  });

  const edgeSwipeHandlers = mobileSwipeEnabled
    ? { onTouchStart, onTouchEnd }
    : undefined;

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

  const goArtistPage = () => {
    if (!video.artistName?.trim()) return;
    onClose();
    navigate(artistPath(video.artistName));
  };

  const navButtons = (
    <>
      {prevVideo ? (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-2 text-white transition-colors hover:bg-black/75 sm:left-2 sm:p-3 md:flex"
          aria-label="Previous video"
        >
          <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
        </button>
      ) : null}
      {nextVideo ? (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-2 text-white transition-colors hover:bg-black/75 sm:right-2 sm:p-3 md:flex"
          aria-label="Next video"
        >
          <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
        </button>
      ) : null}
    </>
  );

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="absolute right-2 top-2 z-30 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 sm:right-4 sm:top-4"
      aria-label="Close"
    >
      <X className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] flex animate-fade-in bg-black">
      {/* Mobile: video fills viewport; details scroll below */}
      <div
        ref={mobileSwipeRef}
        className="flex h-[100dvh] w-full flex-col md:hidden"
      >
        <div className="relative min-h-0 flex-1">
          <YouTubeEmbed
            video={video}
            embedActive={mobileEmbedActive}
            onActivateEmbed={() => setMobileEmbedActive(true)}
            edgeSwipeHandlers={edgeSwipeHandlers}
          />
          {closeButton}
        </div>
        <YouTubeModalSidebar video={video} goArtistPage={goArtistPage} />
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden h-full w-full max-w-6xl items-stretch justify-center md:flex">
        <div className="flex h-full max-h-[100dvh] w-full overflow-hidden border border-momentum-teal/20 bg-black/95">
          <div className="relative flex min-h-0 w-2/3 flex-shrink-0 bg-black">
            <YouTubeEmbed
              video={video}
              embedActive={true}
              onActivateEmbed={() => {}}
            />
            {closeButton}
            {navButtons}
          </div>
          <YouTubeModalSidebar video={video} goArtistPage={goArtistPage} />
        </div>
      </div>
    </div>
  );
}
