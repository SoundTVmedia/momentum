import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import HeroConcertBackdrop, {
  clipToHeroSlide,
  type HeroClipSlide,
} from '@/react-app/components/HeroConcertBackdrop';
import FindAShowModal from '@/react-app/components/FindAShowModal';
import JamBaseWordmark from '@/react-app/components/JamBaseWordmark';
import { JAMBASE_HOME_URL } from '@/react-app/components/PoweredByJamBase';
import ClipModal from '@/react-app/components/ClipModal';
import UserAvatar from '@/react-app/components/UserAvatar';
import { useAppPullRefresh } from '@/react-app/hooks/useAppPullRefresh';
import type { ClipWithUser } from '@/shared/types';
import { artistPath, clipShowClipsPath } from '@/shared/app-paths';
import { resolveClipEventTitle } from '@/shared/event-title';

const SLIDE_COUNT = 3;
const SLIDE_MS = 8000;

function slidesFromClips(clips: ClipWithUser[] | undefined, max = 8): HeroClipSlide[] {
  const next: HeroClipSlide[] = [];
  const seen = new Set<string>();
  for (const clip of clips ?? []) {
    const slide = clipToHeroSlide(clip);
    if (!slide || seen.has(slide.src)) continue;
    seen.add(slide.src);
    next.push(slide);
    if (next.length >= max) break;
  }
  return next;
}

function shuffleCopy<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j]!;
    next[j] = tmp!;
  }
  return next;
}

function playableClips(clips: ClipWithUser[] | undefined): ClipWithUser[] {
  return (clips ?? []).filter((clip) => clipToHeroSlide(clip));
}

/** Different featured clip on each cold load / pull-refresh. */
function pickRandomPlayable(clips: ClipWithUser[] | undefined): ClipWithUser | null {
  const playable = playableClips(clips);
  if (playable.length === 0) return null;
  const index = Math.floor(Math.random() * playable.length);
  return playable[index] ?? null;
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

  const poster = slide?.poster ?? '';
  const name = slide?.displayName ?? clip?.user_display_name?.trim() ?? 'Fan';
  const canOpen = clip != null && slide != null;
  const profileHref = slide?.mochaUserId ? `/users/${slide.mochaUserId}` : undefined;
  const eventTitle = clip ? resolveClipEventTitle(clip) : null;
  const artistName = clip?.artist_name?.trim() || null;
  const showHref = clip ? clipShowClipsPath(clip) : '';
  const canLinkShow = Boolean(showHref && showHref !== '/');
  const artistHref = artistName ? artistPath(artistName) : '';
  const canLinkArtist = Boolean(artistHref && artistHref !== '/artists');

  const onPlay = () => {
    if (consumeSwipeClick()) return;
    onOpen();
  };

  const onNavClick = (e: React.MouseEvent) => {
    if (consumeSwipeClick()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
  };

  const userRow = slide ? (
    profileHref ? (
      <Link
        to={profileHref}
        onClick={onNavClick}
        className="flex max-w-full items-center gap-2.5 rounded-full py-0.5 hover:opacity-90"
        aria-label={`Open profile for ${name}`}
      >
        <UserAvatar
          imageUrl={slide.avatarUrl}
          displayName={name}
          seed={slide.mochaUserId}
          alt={name}
          sizeClass="h-9 w-9 sm:h-10 sm:w-10"
          letterClassName="text-sm font-semibold"
        />
        <span className="min-w-0 truncate text-sm font-semibold text-white drop-shadow sm:text-base">
          {name}
        </span>
      </Link>
    ) : (
      <div className="flex max-w-full items-center gap-2.5">
        <UserAvatar
          imageUrl={slide.avatarUrl}
          displayName={name}
          seed={slide.mochaUserId}
          alt={name}
          sizeClass="h-9 w-9 sm:h-10 sm:w-10"
          letterClassName="text-sm font-semibold"
        />
        <span className="min-w-0 truncate text-sm font-semibold text-white drop-shadow sm:text-base">
          {name}
        </span>
      </div>
    )
  ) : null;

  const showRow = eventTitle ? (
    canLinkShow ? (
      <Link
        to={showHref}
        onClick={onNavClick}
        className="block max-w-full truncate whitespace-nowrap text-sm font-bold text-white drop-shadow hover:opacity-90 sm:text-base"
        aria-label={`Open show page for ${eventTitle}`}
      >
        {eventTitle}
      </Link>
    ) : (
      <p className="max-w-full truncate whitespace-nowrap text-sm font-bold text-white drop-shadow sm:text-base">
        {eventTitle}
      </p>
    )
  ) : null;

  const artistRow = artistName ? (
    canLinkArtist ? (
      <Link
        to={artistHref}
        onClick={onNavClick}
        className="block max-w-full truncate text-xs font-semibold text-white/90 drop-shadow hover:opacity-90 sm:text-sm"
        aria-label={`Open artist page for ${artistName}`}
      >
        {artistName}
      </Link>
    ) : (
      <p className="max-w-full truncate text-xs font-semibold text-white/90 drop-shadow sm:text-sm">
        {artistName}
      </p>
    )
  ) : null;

  return (
    <div className="hero-carousel__fill min-h-[14.026rem] sm:min-h-[23.377rem] lg:min-h-[28.052rem]">
      {poster ? (
        <img
          src={poster}
          alt=""
          className="hero-concert-photo__img"
          width={1920}
          height={720}
          decoding="async"
        />
      ) : null}
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/25 to-transparent pb-8 pt-16 sm:pb-11">
        <div className="pointer-events-auto flex max-w-[min(22rem,calc(100%-5.5rem))] flex-col items-start gap-1.5 px-4 text-left sm:px-6">
          <p className="font-headline hero-headline-grad text-left text-xl leading-tight tracking-tight sm:text-2xl md:text-3xl">
            Featured Clip
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/75 sm:text-[0.7rem]">
              Brought to you by
            </span>
            <a
              href={JAMBASE_HOME_URL}
              target="_blank"
              rel="nofollow noopener noreferrer"
              aria-label="JamBase"
              className="text-white hover:text-white/90"
              onClick={onNavClick}
            >
              <JamBaseWordmark className="h-3 w-auto sm:h-3.5" />
            </a>
          </div>
          {userRow}
          {showRow}
          {artistRow}
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const { user } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slidesA, setSlidesA] = useState<HeroClipSlide[]>([]);
  const [slidesB, setSlidesB] = useState<HeroClipSlide[]>([]);
  const [featured, setFeatured] = useState<ClipWithUser | null>(null);
  const [clipModal, setClipModal] = useState<ClipWithUser | null>(null);
  const [findShowOpen, setFindShowOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);

  const loadHeroClips = useCallback(async () => {
    try {
      const [viewedRes, likedRes, latestRes] = await Promise.all([
        fetch('/api/clips?limit=10&sort_by=most_viewed', { credentials: 'include' }),
        fetch('/api/clips?limit=24&sort_by=most_liked', { credentials: 'include' }),
        fetch('/api/clips?limit=16&sort_by=latest', { credentials: 'include' }),
      ]);
      const viewedData = viewedRes.ok
        ? ((await viewedRes.json()) as { clips?: ClipWithUser[] })
        : { clips: [] };
      const likedData = likedRes.ok
        ? ((await likedRes.json()) as { clips?: ClipWithUser[] })
        : { clips: [] };
      const latestData = latestRes.ok
        ? ((await latestRes.json()) as { clips?: ClipWithUser[] })
        : { clips: [] };
      const pool = slidesFromClips(
        [
          ...(viewedData.clips ?? []),
          ...(likedData.clips ?? []),
          ...(latestData.clips ?? []),
        ],
        16,
      );
      // Independent shuffles so slide 1 and 2 start on different clips each load.
      if (pool.length > 0) {
        setSlidesA(shuffleCopy(pool));
        setSlidesB(shuffleCopy(pool).slice(0, 5));
      }
      setFeatured(
        pickRandomPlayable(likedData.clips) ??
          pickRandomPlayable(viewedData.clips) ??
          pickRandomPlayable(latestData.clips),
      );
    } catch {
      /* keep solid backdrop until clips load */
    }
  }, []);

  useEffect(() => {
    void loadHeroClips();
  }, [loadHeroClips]);

  useAppPullRefresh(loadHeroClips);

  useEffect(() => {
    if (paused || reducedMotion || clipModal || findShowOpen) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SLIDE_COUNT);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reducedMotion, clipModal, findShowOpen]);

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
      className="hero-carousel relative z-10 overflow-hidden bg-momentum-ink"
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
              <HeroConcertBackdrop
                key={slidesA[0]?.src ?? 'slide-a'}
                slides={slidesA}
                playing={index === 0 && !reducedMotion}
              />
            </div>
            <div className="absolute inset-0 hero-concert-sweep" aria-hidden />
            <div className="absolute inset-0 hero-grad-brand" aria-hidden />
            <div className="absolute inset-0 hero-concert-scrim" aria-hidden />
            <div className="relative z-10 flex min-h-[14.026rem] flex-col items-center justify-center px-4 py-3 sm:min-h-[23.377rem] sm:px-6 sm:py-8 lg:min-h-[28.052rem] lg:px-8">
              <h1 className="font-headline hero-headline-grad text-center text-2xl sm:text-4xl md:text-5xl lg:text-[3.25rem] leading-tight tracking-tight">
                Where Live Music Lives
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:mt-6">
                {user ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white momentum-grad-interactive shadow-lg shadow-momentum-ember/25 hover:scale-[1.03] transition-transform sm:px-8 sm:py-3 sm:text-base"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (consumeSwipeClick()) return;
                      setFindShowOpen(true);
                    }}
                  >
                    Find a Show
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white momentum-grad-interactive shadow-lg shadow-momentum-ember/25 hover:scale-[1.03] transition-transform sm:px-8 sm:py-3 sm:text-base"
                    onClick={(e) => {
                      if (consumeSwipeClick()) e.preventDefault();
                    }}
                  >
                    Get Started
                  </Link>
                )}
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors sm:px-8 sm:py-3 sm:text-base"
                  onClick={(e) => {
                    if (consumeSwipeClick()) e.preventDefault();
                  }}
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
                key={slidesB[0]?.src ?? 'slide-b'}
                slides={slidesB}
                playing={index === 1 && !reducedMotion}
              />
            </div>
            <div className="absolute inset-0 hero-jambase-grade" aria-hidden />
            <div className="absolute inset-0 hero-jambase-wash" aria-hidden />
            <div className="relative z-10 flex min-h-[14.026rem] flex-col items-center justify-center px-4 py-3 text-center sm:min-h-[23.377rem] sm:px-6 sm:py-8 lg:min-h-[28.052rem]">
              <p className="font-headline hero-headline-grad w-full min-w-0 max-w-4xl px-1 text-center text-[1.15rem] leading-tight tracking-tight sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                Go See Live Music,
                <span className="block">and Use Feedback to Capture it All</span>
              </p>
              <div className="mt-2 flex flex-col items-center sm:mt-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/80 sm:text-[0.7rem]">
                  Powered By
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
      {findShowOpen ? <FindAShowModal onClose={() => setFindShowOpen(false)} /> : null}
    </section>
  );
}
