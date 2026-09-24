import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  X,
  Heart,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Music,
} from 'lucide-react';
import { useHorizontalFeedSwipe } from '@/react-app/hooks/useHorizontalFeedSwipe';
import { useTrackpadFeedSwipe } from '@/react-app/hooks/useTrackpadFeedSwipe';
import { useVerticalSwipeUp } from '@/react-app/hooks/useVerticalSwipeUp';
import { useClipArtistProfile } from '@/react-app/hooks/useClipArtistProfile';
import { useClipPlaybackTickets } from '@/react-app/hooks/useClipPlaybackTickets';
import { useTicketmaster } from '@/react-app/hooks/useTicketmaster';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { artistPath } from '@/shared/app-paths';
import { jamBaseEventVenueName } from '@/shared/jambase-events';
import { openExternalKeepClipPlaying } from '@/react-app/lib/open-external-keep-clip-playing';
import ClipModalBuyMerch from '@/react-app/components/ClipModalBuyMerch';
import ClipModalBuyTickets from '@/react-app/components/ClipModalBuyTickets';
import {
  ClipTicketSheetDetails,
  ClipTicketSheetHeader,
} from '@/react-app/components/ClipModalTicketSheet';
import {
  ensureYoutubeUnmuted,
  loadYoutubeIframeApi,
  startYoutubeAutoplay,
  YT_PLAYER_STATE,
  type YTPlayer,
} from '@/react-app/lib/youtube-iframe-api';

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

function YouTubeEmbed({
  video,
  edgeSwipeHandlers,
}: {
  video: YoutubeVideoItem;
  edgeSwipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const userPausedRef = useRef(false);
  const videoIdRef = useRef(video.videoId);

  useEffect(() => {
    videoIdRef.current = video.videoId;
    userPausedRef.current = false;
  }, [video.videoId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    userPausedRef.current = false;

    const mountPlayer = async () => {
      try {
        await loadYoutubeIframeApi();
      } catch {
        return;
      }
      if (cancelled || !hostRef.current || !window.YT?.Player) return;

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId: video.videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event) => {
            startYoutubeAutoplay(event.target);
          },
          onStateChange: (event) => {
            if (userPausedRef.current) return;
            const state = event.data;
            if (state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING) {
              ensureYoutubeUnmuted(event.target);
            }
            if (
              state === YT_PLAYER_STATE.UNSTARTED ||
              state === YT_PLAYER_STATE.CUED
            ) {
              startYoutubeAutoplay(event.target);
            }
          },
        },
      });
    };

    void mountPlayer();

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [video.videoId]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const player = playerRef.current;
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      if (!player?.setSize || width <= 0 || height <= 0) return;
      try {
        player.setSize(width, height);
      } catch {
        /* player not ready */
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [video.videoId]);

  return (
    <div ref={frameRef} className="absolute inset-0 bg-black">
      <div ref={hostRef} className="h-full w-full" title={video.title} />
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
  buyActions,
}: {
  video: YoutubeVideoItem;
  goArtistPage: () => void;
  buyActions: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-900/50 md:w-1/3">
      <div className="flex-shrink-0 border-b border-white/10 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-red-400/90">
          YouTube
        </p>
        <h2 className="text-lg font-bold leading-snug text-white sm:text-xl">{video.title}</h2>
        {video.artistName ? (
          <button
            type="button"
            onClick={goArtistPage}
            className="mt-2 inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-momentum-flare/90 transition-colors hover:text-momentum-flare"
          >
            <Music className="h-4 w-4 shrink-0 text-momentum-rose" />
            <span className="truncate">{video.artistName}</span>
          </button>
        ) : null}
        {video.channelTitle ? (
          <p className="mt-1 truncate text-sm text-gray-400">{video.channelTitle}</p>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
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

      <div className="flex-shrink-0 space-y-3 border-t border-white/10 p-4">
        {buyActions}
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
  const gestureSurfaceRef = useRef<HTMLDivElement>(null);
  const { trackTicketClick } = useTicketmaster();
  const { websiteUrl: artistWebsiteUrl, loading: artistProfileLoading } = useClipArtistProfile(
    video.artistName,
  );
  const { show: nearestTicketShow, loading: nearestTicketLoading } = useClipPlaybackTickets(
    video.artistName,
  );
  const [ticketSheetOpen, setTicketSheetOpen] = useState(false);

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

  const ticketEventTitle =
    nearestTicketShow && typeof nearestTicketShow.event.name === 'string'
      ? nearestTicketShow.event.name
      : 'Upcoming show';

  const openExternal = useCallback(async (url: string) => {
    await openExternalKeepClipPlaying(url);
  }, []);

  const openTicketSheet = useCallback(() => {
    if (!nearestTicketShow?.ticketUrl) return;
    setTicketSheetOpen(true);
    const ev = nearestTicketShow.event;
    const eventId = String(ev.identifier ?? ev['@id'] ?? ev.id ?? 'jambase');
    const venueName = jamBaseEventVenueName(ev);
    void trackTicketClick(
      eventId,
      ticketEventTitle,
      nearestTicketShow.ticketUrl,
      undefined,
      undefined,
      undefined,
      venueName || undefined,
    );
  }, [nearestTicketShow, ticketEventTitle, trackTicketClick]);

  const closeTicketSheet = useCallback(() => {
    setTicketSheetOpen(false);
  }, []);

  useEffect(() => {
    setTicketSheetOpen(false);
  }, [video.videoId]);

  const gesturesIdle = !ticketSheetOpen;
  const mobileSwipeEnabled = canFeedNav && mobileViewport && gesturesIdle;
  const ticketSwipeEnabled =
    mobileViewport && gesturesIdle && !!nearestTicketShow?.ticketUrl;

  const { containerRef: mobileSwipeRef, onTouchStart, onTouchEnd } = useHorizontalFeedSwipe({
    enabled: mobileSwipeEnabled,
    onPrev: goPrev,
    onNext: goNext,
  });

  const edgeSwipeHandlers = mobileSwipeEnabled
    ? { onTouchStart, onTouchEnd }
    : undefined;

  useVerticalSwipeUp({
    enabled: ticketSwipeEnabled,
    containerRef: mobileSwipeRef,
    onSwipeUp: openTicketSheet,
  });

  useTrackpadFeedSwipe({
    enabled: gesturesIdle,
    containerRef: gestureSurfaceRef,
    onPrev: goPrev,
    onNext: goNext,
    onSwipeUp: openTicketSheet,
    horizontalEnabled: canFeedNav,
    verticalEnabled: !!nearestTicketShow?.ticketUrl,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ticketSheetOpen) {
          closeTicketSheet();
          return;
        }
        onClose();
        return;
      }
      if (!canFeedNav || ticketSheetOpen) return;
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
  }, [canFeedNav, goPrev, goNext, onClose, ticketSheetOpen, closeTicketSheet]);

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
          className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-3 text-white transition-colors hover:bg-black/75 md:flex"
          aria-label="Previous video"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      ) : null}
      {nextVideo ? (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/55 p-3 text-white transition-colors hover:bg-black/75 md:flex"
          aria-label="Next video"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      ) : null}
    </>
  );

  const mobileOverlay = (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-3 pb-12 pt-3">
        <div className="pointer-events-auto flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-red-400/90">YouTube</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full glass-icon-btn p-2 text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        <div className="pointer-events-auto pr-2">
          <h2 className="line-clamp-2 text-lg font-bold leading-snug text-white">{video.title}</h2>
          {video.artistName ? (
            <button
              type="button"
              onClick={goArtistPage}
              className="mt-1 inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-momentum-flare/90"
            >
              <Music className="h-4 w-4 shrink-0 text-momentum-rose" />
              <span className="truncate">{video.artistName}</span>
            </button>
          ) : null}
          {video.channelTitle ? (
            <p className="mt-0.5 truncate text-xs text-gray-400">{video.channelTitle}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-300">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-red-400" />
              {formatCount(video.likeCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5 text-gray-400" />
              {formatCount(video.viewCount)}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2" data-no-clip-swipe="">
            <ClipModalBuyMerch
              websiteUrl={artistWebsiteUrl}
              loading={artistProfileLoading}
              onOpen={openExternal}
            />
            <ClipModalBuyTickets
              show={nearestTicketShow}
              loading={nearestTicketLoading}
              onActivate={openTicketSheet}
            />
          </div>
          <a
            href={video.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300"
          >
            Open on YouTube
            <ExternalLink className="h-4 w-4" />
          </a>
          {canFeedNav ? (
            <p className="mt-2 text-[11px] uppercase tracking-wide text-white/45">
              Swipe left or right for next video
            </p>
          ) : null}
        </div>
      </div>
    </>
  );

  const youtubePlayer = (
    <YouTubeEmbed
      key={video.videoId}
      video={video}
      edgeSwipeHandlers={mobileViewport ? edgeSwipeHandlers : undefined}
    />
  );

  const showTicketSheet = ticketSheetOpen && !!nearestTicketShow?.ticketUrl;
  const ticketHeader = () =>
    showTicketSheet ? (
      <ClipTicketSheetHeader eventTitle={ticketEventTitle} onClose={closeTicketSheet} />
    ) : null;
  const ticketDetails = () =>
    showTicketSheet && nearestTicketShow?.ticketUrl ? (
      <ClipTicketSheetDetails
        event={nearestTicketShow.event}
        ticketUrl={nearestTicketShow.ticketUrl}
        eventTitle={ticketEventTitle}
        onOpenTickets={openExternal}
      />
    ) : null;

  const desktopBuyActions = (
    <div className="flex flex-col gap-2" data-no-clip-swipe="">
      <ClipModalBuyMerch
        websiteUrl={artistWebsiteUrl}
        loading={artistProfileLoading}
        className="w-full"
        onOpen={openExternal}
      />
      <ClipModalBuyTickets
        show={nearestTicketShow}
        loading={nearestTicketLoading}
        onActivate={openTicketSheet}
        className="w-full"
      />
    </div>
  );

  return (
    <div ref={gestureSurfaceRef} className="fixed inset-0 z-[110] overflow-hidden bg-black">
      <div
        ref={mobileSwipeRef}
        className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 ${mobileViewport ? '' : 'hidden'}`}
      >
        {ticketHeader()}
        <div className={`relative min-h-0 flex-1 ${showTicketSheet ? 'px-4 py-3' : ''}`}>
          {mobileViewport ? youtubePlayer : null}
          {showTicketSheet ? null : mobileOverlay}
        </div>
        {ticketDetails()}
      </div>

      <div className={`relative h-[100dvh] w-full ${mobileViewport ? 'hidden' : 'block'}`}>
        <div className="mx-auto flex h-full max-w-6xl">
          <div className="relative flex h-full min-h-0 flex-1 flex-col bg-slate-950">
            {ticketHeader()}
            <div className={`relative min-h-0 flex-1 bg-black ${showTicketSheet ? 'px-4 py-3' : ''}`}>
              {!mobileViewport ? youtubePlayer : null}
              {showTicketSheet ? null : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 z-30 rounded-full glass-icon-btn p-2 text-white transition-colors hover:bg-black/70"
                    aria-label="Close"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  {navButtons}
                </>
              )}
            </div>
            {ticketDetails()}
          </div>
          <YouTubeModalSidebar
            video={video}
            goArtistPage={goArtistPage}
            buyActions={desktopBuyActions}
          />
        </div>
      </div>
    </div>
  );
}
