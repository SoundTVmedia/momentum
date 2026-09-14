import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import HeroConcertBackdrop, {
  clipToHeroSlide,
  type HeroClipSlide,
} from '@/react-app/components/HeroConcertBackdrop';
import JamBaseWordmark from '@/react-app/components/JamBaseWordmark';
import { JAMBASE_HOME_URL } from '@/react-app/components/PoweredByJamBase';
import { HERO_CONCERT_FALLBACK_IMAGE } from '@/react-app/data/heroStockConcert';
import ClipModal from '@/react-app/components/ClipModal';
import UserAvatar from '@/react-app/components/UserAvatar';
import type { ClipWithUser } from '@/shared/types';
import { clipShowClipsPath } from '@/shared/app-paths';
import { resolveClipEventTitle } from '@/shared/event-title';

const SLIDE_COUNT = 3;
const SLIDE_MS = 8000;

function slidesFromClips(clips: ClipWithUser[] | undefined, max = 8): HeroClipSlide[] {
  const next: HeroClipSlide[] = [];
  for (const clip of clips ?? []) {
    const slide = clipToHeroSlide(clip);
    if (!slide) continue;
    next.push(slide);
    if (next.length >= max) break;
  }
  return next;
}

function playableClips(clips: ClipWithUser[] | undefined): ClipWithUser[] {
  return (clips ?? []).filter((clip) => clipToHeroSlide(clip));
}

function pickMostLikedRecent(clips: ClipWithUser[] | undefined): ClipWithUser | null {
  const playable = playableClips(clips);
  if (playable.length === 0) return null;
  return [...playable].sort((a, b) => {
    const likes = (b.likes_count ?? 0) - (a.likes_count ?? 0);
    if (likes !== 0) return likes;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  })[0];
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function FeaturedClipSlide({
  clip,
  playing,
  onOpen,
  consumeSwipeClick,
}: {
  clip: ClipWithUser | null;
  playing: boolean;
  onOpen: () => void;
  consumeSwipeClick: () => boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const slide = clip ? clipToHeroSlide(clip) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing, slide?.src]);

  const poster = slide?.poster ?? HERO_CONCERT_FALLBACK_IMAGE;
  const name = slide?.displayName ?? clip?.user_display_name?.trim() ?? 'Fan';
  const canOpen = clip != null && slide != null;
  const profileHref = slide?.mochaUserId ? `/users/${slide.mochaUserId}` : undefined;
  const eventTitle = clip ? resolveClipEventTitle(clip) : null;
  const artistName = clip?.artist_name?.trim() || null;
  const showHref = clip ? clipShowClipsPath(clip) : '';
  const canLinkShow = Boolean(showHref && showHref !== '/');

  const onPlay = () => {
    if (consumeSwipeClick()) return;
    onOpen();
  };

  const onNavClick = (e: React.MouseEvent) => {
    if (consumeSwipeClick()) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div className="hero-carousel__fill">
      <img
        src={poster}
        alt=""
        className="hero-concert-photo__img"
        width={1920}
        height={720}
        decoding="async"
      />
      {slide ? (
        <div className="hero-video-backdrop-wrap">
          <video
            ref={videoRef}
            className="hero-video-backdrop is-live"
            src={slide.src}
            poster={slide.poster}
            muted
            loop
            playsInline
            autoPlay={playing}
            preload="auto"
            disablePictureInPicture
            controls={false}
            controlsList="nodownload nofullscreen noremoteplayback"
            aria-hidden
          />
        </div>
      ) : null}
      <div className="absolute inset-0 hero-concert-scrim" aria-hidden />
      {canOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label={`Play featured clip by ${name}`}
          onClick={onPlay}
        />
      ) : null}
      <div className="pointer-events-none relative z-20 flex min-h-[10.08rem] flex-col items-center justify-center px-4 py-3 sm:min-h-[16.8rem] sm:px-6 sm:py-8 lg:min-h-[20.16rem]">
        <p className="font-headline hero-headline-grad text-center text-2xl sm:text-4xl md:text-5xl leading-tight tracking-tight">
          Featured Clip
        </p>
        {slide && profileHref ? (
          <Link
            to={profileHref}
            onClick={onNavClick}
            className="pointer-events-auto mt-2 flex items-center justify-center gap-3 rounded-full px-2 py-1 hover:opacity-90 sm:mt-5"
          >
            <UserAvatar
              imageUrl={slide.avatarUrl}
              displayName={name}
              seed={slide.mochaUserId}
              alt={name}
              sizeClass="h-10 w-10 sm:h-11 sm:w-11"
              letterClassName="text-sm font-semibold"
            />
            <span className="max-w-[16rem] truncate text-sm font-semibold text-white drop-shadow sm:text-base">
              {name}
            </span>
          </Link>
        ) : slide ? (
          <div className="mt-2 flex items-center justify-center gap-3 sm:mt-5">
            <UserAvatar
              imageUrl={slide.avatarUrl}
              displayName={name}
              seed={slide.mochaUserId}
              alt={name}
              sizeClass="h-10 w-10 sm:h-11 sm:w-11"
              letterClassName="text-sm font-semibold"
            />
            <span className="max-w-[16rem] truncate text-sm font-semibold text-white drop-shadow sm:text-base">
              {name}
            </span>
          </div>
        ) : null}
      </div>
      {eventTitle || artistName ? (
        canLinkShow ? (
          <Link
            to={showHref}
            onClick={onNavClick}
            className="absolute bottom-6 left-4 z-20 max-w-[min(22rem,calc(100%-5.5rem))] text-left drop-shadow-lg sm:bottom-11 sm:left-6"
            aria-label={`Open show page for ${eventTitle || artistName}`}
          >
            {eventTitle ? (
              <p className="text-sm font-bold leading-snug text-white line-clamp-2 sm:text-base">
                {eventTitle}
              </p>
            ) : null}
            {artistName ? (
              <p className="mt-0.5 text-xs font-semibold text-white/90 sm:text-sm">{artistName}</p>
            ) : null}
          </Link>
        ) : (
          <div className="absolute bottom-6 left-4 z-20 max-w-[min(22rem,calc(100%-5.5rem))] text-left drop-shadow-lg sm:bottom-11 sm:left-6">
            {eventTitle ? (
              <p className="text-sm font-bold leading-snug text-white line-clamp-2 sm:text-base">
                {eventTitle}
              </p>
            ) : null}
            {artistName ? (
              <p className="mt-0.5 text-xs font-semibold text-white/90 sm:text-sm">{artistName}</p>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

export default function HeroSection() {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slides, setSlides] = useState<HeroClipSlide[]>([]);
  const [featured, setFeatured] = useState<ClipWithUser | null>(null);
  const [clipModal, setClipModal] = useState<ClipWithUser | null>(null);
  const touchStartX = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [viewedRes, likedRes] = await Promise.all([
          fetch('/api/clips?limit=10&sort_by=most_viewed', { credentials: 'include' }),
          fetch('/api/clips?limit=24&sort_by=most_liked', { credentials: 'include' }),
        ]);
        const viewedData = viewedRes.ok
          ? ((await viewedRes.json()) as { clips?: ClipWithUser[] })
          : { clips: [] };
        const likedData = likedRes.ok
          ? ((await likedRes.json()) as { clips?: ClipWithUser[] })
          : { clips: [] };
        if (cancelled) return;
        const viewedSlides = slidesFromClips(viewedData.clips, 10);
        if (viewedSlides.length > 0) setSlides(viewedSlides);
        setFeatured(
          pickMostLikedRecent(likedData.clips) ?? pickMostLikedRecent(viewedData.clips),
        );
      } catch {
        /* stock fallback in backdrop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || clipModal) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SLIDE_COUNT);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reducedMotion, clipModal]);

  const goTo = (next: number) => {
    setIndex((next + SLIDE_COUNT) % SLIDE_COUNT);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const delta = e.changedTouches[0].clientX - start;
    if (Math.abs(delta) > 48) ignoreClickRef.current = true;
    if (delta > 48) goTo(index - 1);
    else if (delta < -48) goTo(index + 1);
  };

  const consumeSwipeClick = () => {
    if (!ignoreClickRef.current) return false;
    ignoreClickRef.current = false;
    return true;
  };

  const openFeaturedClip = () => {
    if (consumeSwipeClick()) return;
    if (featured) setClipModal(featured);
  };

  return (
    <section
      className="hero-carousel relative z-30 overflow-hidden bg-momentum-ink"
      aria-label="Home highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="hero-carousel__track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        <div className="hero-carousel__slide" aria-hidden={index !== 0}>
          <div className="hero-carousel__fill">
            <div className="absolute inset-0 hero-concert-photo" aria-hidden>
              <HeroConcertBackdrop slides={slides} playing={index === 0 && !reducedMotion} />
            </div>
            <div className="absolute inset-0 hero-concert-sweep" aria-hidden />
            <div className="absolute inset-0 hero-grad-brand" aria-hidden />
            <div className="absolute inset-0 hero-concert-scrim" aria-hidden />
            <div className="relative z-10 flex min-h-[10.08rem] flex-col items-center justify-center px-4 py-3 sm:min-h-[16.8rem] sm:px-6 sm:py-8 lg:min-h-[20.16rem] lg:px-8">
              <h1 className="font-headline hero-headline-grad text-center text-2xl sm:text-4xl md:text-5xl lg:text-[3.25rem] leading-tight tracking-tight">
                Where Live Music Lives
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:mt-6">
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white momentum-grad-interactive shadow-lg shadow-momentum-ember/25 hover:scale-[1.03] transition-transform sm:px-8 sm:py-3 sm:text-base"
                >
                  Get Started
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors sm:px-8 sm:py-3 sm:text-base"
                >
                  Take the Tour
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-carousel__slide" aria-hidden={index !== 1} style={{ backgroundColor: '#001a30' }}>
          <div className="hero-carousel__fill" style={{ backgroundColor: '#001a30' }}>
            <div className="absolute inset-0 hero-concert-photo" aria-hidden>
              <HeroConcertBackdrop
                slides={slides.slice(0, 5)}
                playing={index === 1 && !reducedMotion}
              />
            </div>
            <div className="absolute inset-0 hero-jambase-grade" aria-hidden />
            <div className="absolute inset-0 hero-jambase-wash" aria-hidden />
            <div className="relative z-10 flex min-h-[10.08rem] flex-col items-center justify-center px-4 py-3 text-center sm:min-h-[16.8rem] sm:px-6 sm:py-8 lg:min-h-[20.16rem]">
              <p className="font-headline hero-headline-grad w-full min-w-0 max-w-4xl px-1 text-center text-[1.15rem] leading-tight tracking-tight sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                Go See Live Music,
                <span className="block">and Use Feedback to Capture it All</span>
              </p>
              <div className="mt-2 flex flex-col items-center sm:mt-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/80 sm:text-[0.7rem]">
                  Proudly Powered By
                </p>
                <a
                  href={JAMBASE_HOME_URL}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  aria-label="JamBase"
                  className="mt-1.5 text-white/90 hover:text-white sm:mt-2"
                >
                  <JamBaseWordmark className="h-4 w-auto sm:h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-carousel__slide" aria-hidden={index !== 2}>
          <FeaturedClipSlide
            clip={featured}
            playing={index === 2 && !reducedMotion && !clipModal}
            onOpen={openFeaturedClip}
            consumeSwipeClick={consumeSwipeClick}
          />
        </div>
      </div>

      <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-2">
        {['Where Live Music Lives', 'JamBase', 'Featured clip'].map((label, i) => (
          <button
            key={label}
            type="button"
            aria-label={`Show ${label}`}
            aria-current={index === i}
            className={`h-2 rounded-full transition-all ${
              index === i ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      {clipModal ? (
        <ClipModal clip={clipModal} onClose={() => setClipModal(null)} />
      ) : null}
    </section>
  );
}
