import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Link } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import HeroConcertBackdrop, {
  clipToHeroSlide,
  playInlineHeroVideo,
  primeInlineHeroVideo,
  type HeroClipSlide,
} from '@/react-app/components/HeroConcertBackdrop';
import FindAShowModal from '@/react-app/components/FindAShowModal';
import JamBaseWordmark from '@/react-app/components/JamBaseWordmark';
import { JAMBASE_HOME_URL } from '@/react-app/components/PoweredByJamBase';
import ClipModal from '@/react-app/components/ClipModal';
import { useAppPullRefresh } from '@/react-app/hooks/useAppPullRefresh';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { fetchRelatedClips } from '@/react-app/lib/fetchRelatedClips';
import { prefetchModalPlayback } from '@/react-app/lib/clipPlaybackPrefetch';
import type { ClipWithUser } from '@/shared/types';
import { apiEventClipsPath } from '@/shared/app-paths';
import { resolveClipEventTitle } from '@/shared/event-title';
import {
  markTourPending,
  PRODUCT_TOUR_AUTH_HREF,
  TOUR_ANCHORS,
} from '@/react-app/lib/productTour';

const SLIDE_COUNT = 3;
const SLIDE_MS = 8000;
const BUD_LIGHT_LOGO_URL = 'https://www.budlight.com/img/header/logo.png';

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

function playableClipSrc(clip: ClipWithUser): string | null {
  return clipToHeroSlide(clip)?.src ?? null;
}

/** Unique playable clips in first-seen order (by preview src). */
function uniquePlayableClips(clips: ClipWithUser[] | undefined): ClipWithUser[] {
  const next: ClipWithUser[] = [];
  const seen = new Set<string>();
  for (const clip of clips ?? []) {
    const src = playableClipSrc(clip);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    next.push(clip);
  }
  return next;
}

function asSingleHeroSlide(clip: ClipWithUser | null): HeroClipSlide[] {
  if (!clip) return [];
  const slide = clipToHeroSlide(clip);
  return slide ? [slide] : [];
}

function firstUnusedClip(candidates: ClipWithUser[], usedSrcs: Set<string>): ClipWithUser | null {
  for (const clip of candidates) {
    const src = playableClipSrc(clip);
    if (src && !usedSrcs.has(src)) return clip;
  }
  return null;
}

/**
 * Slide 1 and 2 each get one clip (different when the pool has 2+).
 * Slide 3 is the featured clip, preferring an unused liked clip.
 * Shuffle the inputs before calling so each reload picks a new trio.
 */
export function assignHeroCarouselClips(
  pool: ClipWithUser[],
  featuredCandidates: ClipWithUser[] = [],
): {
  slideA: HeroClipSlide[];
  slideB: HeroClipSlide[];
  featured: ClipWithUser | null;
} {
  const unique = uniquePlayableClips(pool);
  const first = unique[0] ?? null;
  const second = unique[1] ?? first;
  const usedSrcs = new Set(
    [first, second].map((clip) => (clip ? playableClipSrc(clip) : null)).filter((src): src is string => Boolean(src)),
  );
  const featured =
    firstUnusedClip(uniquePlayableClips(featuredCandidates), usedSrcs) ??
    firstUnusedClip(unique.slice(2), usedSrcs) ??
    first;

  return {
    slideA: asSingleHeroSlide(first),
    slideB: asSingleHeroSlide(second),
    featured,
  };
}

function clipFeedKey(clip: ClipWithUser): string | number | null {
  if (typeof clip.id === 'number') return clip.id;
  const url = clip.video_url?.trim();
  return url || null;
}

/** Keep the featured clip in the player feed; prefer show order when the API already includes it. */
export function mergeFeaturedShowFeed(
  featured: ClipWithUser,
  related: ClipWithUser[],
): ClipWithUser[] {
  const featuredKey = clipFeedKey(featured);
  if (related.length === 0) return [featured];
  if (
    featuredKey != null &&
    related.some((clip) => clipFeedKey(clip) === featuredKey)
  ) {
    return related;
  }
  return [featured, ...related];
}

const includeFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, credentials: 'include' });

async function fetchFeaturedShowClips(
  clip: ClipWithUser,
  signal: AbortSignal,
): Promise<ClipWithUser[]> {
  const clipId = clipNumericId(clip);
  if (clipId != null) {
    try {
      const related = await fetchRelatedClips(clipId, signal);
      if (related.scope === 'show' && related.clips.length > 0) {
        return mergeFeaturedShowFeed(clip, related.clips);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  const eventApi = apiEventClipsPath(resolveClipEventTitle(clip));
  if (eventApi) {
    try {
      const res = await includeFetch(`${eventApi}?sort_by=time_posted`, { signal });
      if (res.ok) {
        const data = (await res.json()) as { clips?: ClipWithUser[] };
        if (data.clips && data.clips.length > 0) {
          return mergeFeaturedShowFeed(clip, data.clips);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
    }
  }

  return [clip];
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

function FeaturedClipMedia({
  clip,
  playing,
  active,
}: {
  clip: ClipWithUser | null;
  playing: boolean;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const slide = clip ? clipToHeroSlide(clip) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    primeInlineHeroVideo(video);
    if (playing) {
      playInlineHeroVideo(video);
    } else {
      video.pause();
    }
  }, [playing, active, slide?.src]);

  if (!slide) return null;
  if (!playing) {
    return slide.poster ? (
      <img
        src={slide.poster}
        alt=""
        className="hero-concert-photo__img pointer-events-none"
        width={1920}
        height={720}
        decoding="async"
      />
    ) : null;
  }

  return (
    <div className="absolute inset-0">
      {slide.poster ? (
        <img
          src={slide.poster}
          alt=""
          className="hero-concert-photo__img pointer-events-none"
          width={1920}
          height={720}
          decoding="async"
        />
      ) : null}
      <div className="hero-video-backdrop-wrap">
        <video
          ref={(node) => {
            videoRef.current = node;
            primeInlineHeroVideo(node);
          }}
          className="hero-video-backdrop is-live"
          src={slide.src}
          poster={slide.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden
        />
      </div>
    </div>
  );
}

function FeaturedClipSlide({
  clip,
  onOpen,
  consumeSwipeClick,
}: {
  clip: ClipWithUser | null;
  onOpen: () => void;
  consumeSwipeClick: () => boolean;
}) {
  const slide = clip ? clipToHeroSlide(clip) : null;
  const name = slide?.displayName ?? clip?.user_display_name?.trim() ?? 'Fan';
  const canOpen = clip != null && slide != null;
  const eventTitle = clip ? resolveClipEventTitle(clip) : null;

  const onPlay = () => {
    if (!canOpen) return;
    if (consumeSwipeClick()) return;
    onOpen();
  };

  return (
    <button
      type="button"
      className={`hero-carousel__fill hero-featured-clip block w-full min-h-[14.026rem] sm:min-h-[23.377rem] lg:min-h-[28.052rem] appearance-none border-0 bg-transparent p-0 text-left ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}
      aria-label={canOpen ? `Play featured clip by ${name}` : undefined}
      onClick={onPlay}
      onPointerDown={() => {
        if (clip) prefetchModalPlayback(clip);
      }}
    >
      <div className="absolute inset-0 hero-concert-scrim" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent pb-8 pt-16 sm:pb-11">
        <div className="flex max-w-[min(24rem,calc(100%-5.5rem))] flex-col items-start gap-1 px-4 text-left sm:px-6">
          <p className="font-headline hero-headline-grad text-left text-xl leading-tight tracking-tight sm:text-2xl md:text-3xl">
            Sponsored Clip
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/75 sm:text-[0.7rem]">
              Brought to you by
            </span>
            <img
              src={BUD_LIGHT_LOGO_URL}
              alt="Bud Light"
              width={241}
              height={49}
              className="h-4 w-auto sm:h-5"
              decoding="async"
            />
          </div>
          {eventTitle ? (
            <p className="max-w-full truncate text-sm font-bold text-white drop-shadow sm:text-base">
              {eventTitle}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function HeroSection({
  onTakeTour,
  tourActive = false,
}: {
  onTakeTour?: () => void;
  tourActive?: boolean;
}) {
  const { user } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slidesA, setSlidesA] = useState<HeroClipSlide[]>([]);
  const [slidesB, setSlidesB] = useState<HeroClipSlide[]>([]);
  const [featured, setFeatured] = useState<ClipWithUser | null>(null);
  const [featuredFeed, setFeaturedFeed] = useState<ClipWithUser[]>([]);
  const [clipModal, setClipModal] = useState<ClipWithUser | null>(null);
  const [findShowOpen, setFindShowOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  const featuredFeedAbortRef = useRef<AbortController | null>(null);

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
      const pool = uniquePlayableClips([
        ...(viewedData.clips ?? []),
        ...(likedData.clips ?? []),
        ...(latestData.clips ?? []),
      ]);
      const assigned = assignHeroCarouselClips(
        shuffleCopy(pool),
        shuffleCopy(uniquePlayableClips(likedData.clips)),
      );
      setSlidesA(assigned.slideA);
      setSlidesB(assigned.slideB);
      setFeatured(assigned.featured);
    } catch {
      /* keep solid backdrop until clips load */
    }
  }, []);

  useEffect(() => {
    void loadHeroClips();
  }, [loadHeroClips]);

  useAppPullRefresh(loadHeroClips);

  useEffect(() => {
    let removed = false;
    let appHandle: { remove: () => Promise<void> } | undefined;
    const lastRotateAt = { current: Date.now() };
    const rotate = () => {
      const now = Date.now();
      if (now - lastRotateAt.current < 1500) return;
      lastRotateAt.current = now;
      void loadHeroClips();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') rotate();
    };
    document.addEventListener('visibilitychange', onVisible);
    void App.addListener('appStateChange', (state) => {
      if (state.isActive) rotate();
    }).then((handle) => {
      if (removed) {
        void handle.remove();
        return;
      }
      appHandle = handle;
    });
    return () => {
      removed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void appHandle?.remove();
    };
  }, [loadHeroClips]);

  useEffect(() => {
    if (!featured) {
      setFeaturedFeed([]);
      return;
    }
    setFeaturedFeed([featured]);
  }, [featured]);

  useEffect(() => () => featuredFeedAbortRef.current?.abort(), []);

  useEffect(() => {
    if (tourActive) {
      setIndex(0);
      setPaused(true);
      return;
    }
    setPaused(false);
  }, [tourActive]);

  useEffect(() => {
    if (paused || reducedMotion || clipModal || findShowOpen || tourActive) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SLIDE_COUNT);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reducedMotion, clipModal, findShowOpen, tourActive]);

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
    if (!featured) return;
    setClipModal(featured);
    setFeaturedFeed([featured]);
    featuredFeedAbortRef.current?.abort();
    const ac = new AbortController();
    featuredFeedAbortRef.current = ac;
    void fetchFeaturedShowClips(featured, ac.signal)
      .then((clips) => {
        if (!ac.signal.aborted) setFeaturedFeed(clips);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      });
  };

  return (
    <>
    <section
      className="hero-carousel relative z-10 overflow-hidden bg-momentum-ink"
      aria-label="Home highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        if (!tourActive) setPaused(false);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="hero-carousel__stages" aria-hidden>
        <div className={`hero-carousel__stage${index === 0 ? ' is-active' : ''}`}>
          <HeroConcertBackdrop
            key={slidesA[0]?.src ?? 'slide-a'}
            slides={slidesA}
            playing={!reducedMotion}
            loadVideo={!reducedMotion}
            visible={index === 0}
          />
        </div>
        <div className={`hero-carousel__stage${index === 1 ? ' is-active' : ''}`}>
          <HeroConcertBackdrop
            key={slidesB[0]?.src ?? 'slide-b'}
            slides={slidesB}
            playing={!reducedMotion}
            loadVideo={!reducedMotion}
            visible={index === 1}
          />
        </div>
        <div className={`hero-carousel__stage${index === 2 ? ' is-active' : ''}`}>
          <FeaturedClipMedia
            clip={featured}
            playing={!reducedMotion && !clipModal}
            active={index === 2}
          />
        </div>
      </div>
      <div
        className="hero-carousel__track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        <div className="hero-carousel__slide" aria-hidden={index !== 0}>
          <div className="hero-carousel__fill">
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
                    data-tour={TOUR_ANCHORS.findAShow}
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
                {user ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors sm:px-8 sm:py-3 sm:text-base"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (consumeSwipeClick()) return;
                      onTakeTour?.();
                    }}
                  >
                    Take the Tour
                  </button>
                ) : (
                  <Link
                    to={PRODUCT_TOUR_AUTH_HREF}
                    className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors sm:px-8 sm:py-3 sm:text-base"
                    onClick={(e) => {
                      if (consumeSwipeClick()) {
                        e.preventDefault();
                        return;
                      }
                      markTourPending();
                    }}
                  >
                    Take the Tour
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="hero-carousel__slide" aria-hidden={index !== 1}>
          <div className="hero-carousel__fill">
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
            onOpen={openFeaturedClip}
            consumeSwipeClick={consumeSwipeClick}
          />
        </div>
      </div>

      <div className="absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-2">
        {['Where Live Music Lives', 'JamBase', 'Sponsored clip'].map((label, i) => (
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

      {findShowOpen ? <FindAShowModal onClose={() => setFindShowOpen(false)} /> : null}
    </section>
    {clipModal ? (
      <ClipModal
        clip={clipModal}
        onClose={() => setClipModal(null)}
        feedNavigation={
          featuredFeed.length > 1
            ? { clips: featuredFeed, onChangeClip: setClipModal }
            : null
        }
      />
    ) : null}
    </>
  );
}
