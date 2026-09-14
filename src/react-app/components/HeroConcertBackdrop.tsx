import { useEffect, useRef, useState } from 'react';
import {
  HERO_CONCERT_FALLBACK_IMAGE,
  HERO_VIDEO_SRC,
} from '@/react-app/data/heroStockConcert';
import { displayMediaUrl } from '@/shared/media-proxy';
import {
  resolveClipPosterUrl,
  resolveFeedPreviewVideoSrc,
  type ClipPlaybackFields,
} from '@/shared/clip-playback';

export type HeroClipSlide = {
  id?: number;
  src: string;
  poster: string;
  mochaUserId: string;
  displayName: string;
  avatarUrl: string | null;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return reduced;
}

export function clipToHeroSlide(clip: ClipPlaybackFields & {
  id?: number;
  mocha_user_id?: string;
  user_display_name?: string | null;
  user_avatar?: string | null;
}): HeroClipSlide | null {
  if (clip.playback_unplayable) return null;
  const src = resolveFeedPreviewVideoSrc(clip);
  if (!src) return null;
  const posterRaw = resolveClipPosterUrl(clip, HERO_CONCERT_FALLBACK_IMAGE);
  const name = clip.user_display_name?.trim();
  const avatar = clip.user_avatar?.trim();
  return {
    id: typeof clip.id === 'number' ? clip.id : undefined,
    src,
    poster: displayMediaUrl(posterRaw) || HERO_CONCERT_FALLBACK_IMAGE,
    mochaUserId: clip.mocha_user_id?.trim() || '',
    displayName: name || 'Fan',
    avatarUrl: avatar ? displayMediaUrl(avatar) || avatar : null,
  };
}

type HeroConcertBackdropProps = {
  slides?: HeroClipSlide[];
  playing?: boolean;
};

/**
 * Library clips (or stock fallback) as a full-bleed backdrop.
 * Clips hard-cut back-to-back (no opacity fade): the next clip is preloaded
 * on the hidden layer, then swapped with visibility only.
 */
export default function HeroConcertBackdrop({
  slides = [],
  playing = true,
}: HeroConcertBackdropProps) {
  const reducedMotion = usePrefersReducedMotion();
  const layerARef = useRef<HTMLVideoElement>(null);
  const layerBRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [liveLayer, setLiveLayer] = useState<0 | 1>(0);
  const [layerA, setLayerA] = useState({ src: HERO_VIDEO_SRC, poster: HERO_CONCERT_FALLBACK_IMAGE });
  const [layerB, setLayerB] = useState({ src: HERO_VIDEO_SRC, poster: HERO_CONCERT_FALLBACK_IMAGE });
  const advancingRef = useRef(false);
  const pendingSwap = useRef<0 | 1 | null>(null);
  const pendingPoster = useRef(HERO_CONCERT_FALLBACK_IMAGE);
  const primedRef = useRef(false);
  const [displayedPoster, setDisplayedPoster] = useState(HERO_CONCERT_FALLBACK_IMAGE);

  const usingLibrary = slides.length > 0;

  useEffect(() => {
    if (!usingLibrary || primedRef.current) return;
    primedRef.current = true;
    const first = slides[0];
    pendingPoster.current = first.poster;
    pendingSwap.current = 1;
    setActive(0);
    setLayerB({ src: first.src, poster: first.poster });
  }, [usingLibrary, slides]);

  const liveSrc = liveLayer === 0 ? layerA.src : layerB.src;

  useEffect(() => {
    if (reducedMotion) return;
    const videos = [layerARef.current, layerBRef.current];
    videos.forEach((video, index) => {
      if (!video) return;
      if (playing && index === liveLayer) {
        void video.play().catch(() => {
          /* Autoplay may be blocked until a user gesture */
        });
      } else {
        video.pause();
      }
    });
  }, [reducedMotion, playing, liveLayer, liveSrc]);

  const promoteLayer = (layer: 0 | 1) => {
    if (pendingSwap.current !== layer) return;
    pendingSwap.current = null;
    advancingRef.current = false;
    setLiveLayer(layer);
    setDisplayedPoster(pendingPoster.current);

    // Preload the following clip on the hidden layer so the next hard-cut is instant.
    if (slides.length < 2) return;
    const promotedSrc = layer === 0 ? layerA.src : layerB.src;
    const promotedIndex = slides.findIndex((slide) => slide.src === promotedSrc);
    const index = promotedIndex >= 0 ? promotedIndex : active;
    if (promotedIndex >= 0 && promotedIndex !== active) setActive(promotedIndex);
    const next = (index + 1) % slides.length;
    const hidden: 0 | 1 = layer === 0 ? 1 : 0;
    const nextSlide = slides[next];
    pendingPoster.current = nextSlide.poster;
    // Don't mark pendingSwap yet — advance() will claim it when cutting.
    if (hidden === 0) setLayerA({ src: nextSlide.src, poster: nextSlide.poster });
    else setLayerB({ src: nextSlide.src, poster: nextSlide.poster });
  };

  const advance = () => {
    if (slides.length < 2 || advancingRef.current || !playing) return;
    const hidden: 0 | 1 = liveLayer === 0 ? 1 : 0;
    const hiddenVideo = hidden === 0 ? layerARef.current : layerBRef.current;
    const next = (active + 1) % slides.length;
    const nextSlide = slides[next];
    const hiddenAlreadyNext = hidden === 0 ? layerA.src === nextSlide.src : layerB.src === nextSlide.src;

    // Hard-cut immediately when the next clip is already buffered.
    if (hiddenAlreadyNext && hiddenVideo && hiddenVideo.readyState >= 2) {
      advancingRef.current = true;
      pendingPoster.current = nextSlide.poster;
      pendingSwap.current = hidden;
      setActive(next);
      promoteLayer(hidden);
      try {
        hiddenVideo.currentTime = 0;
      } catch {
        /* ignore seek errors on some streams */
      }
      void hiddenVideo.play().catch(() => {});
      return;
    }

    advancingRef.current = true;
    pendingPoster.current = nextSlide.poster;
    pendingSwap.current = hidden;
    setActive(next);
    if (hidden === 0) setLayerA({ src: nextSlide.src, poster: nextSlide.poster });
    else setLayerB({ src: nextSlide.src, poster: nextSlide.poster });
  };

  const failAdvance = () => {
    pendingSwap.current = null;
    advancingRef.current = false;
    advance();
  };

  if (reducedMotion) {
    const stills = usingLibrary ? slides.map((s) => s.poster) : [HERO_CONCERT_FALLBACK_IMAGE];
    return (
      <div className="hero-clip-montage hero-clip-montage--static">
        <div className="hero-clip-montage__slide is-active">
          <img
            src={stills[0]}
            alt=""
            className="hero-clip-montage__media"
            width={1920}
            height={720}
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </div>
    );
  }

  const loopSingle = !usingLibrary || slides.length === 1;

  return (
    <>
      <img
        src={displayedPoster}
        alt=""
        className="hero-concert-photo__img"
        width={1920}
        height={720}
        decoding="async"
        fetchPriority="high"
      />
      <div className="hero-video-backdrop-wrap">
        <video
          ref={layerARef}
          className={`hero-video-backdrop ${liveLayer === 0 ? 'is-live' : ''}`}
          src={layerA.src}
          poster={layerA.poster}
          muted
          loop={loopSingle && liveLayer === 0}
          playsInline
          autoPlay={playing && liveLayer === 0}
          preload="auto"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden
          onLoadedData={() => promoteLayer(0)}
          onCanPlay={() => promoteLayer(0)}
          onEnded={advance}
          onError={failAdvance}
          onTimeUpdate={(e) => {
            if (!usingLibrary || slides.length < 2 || liveLayer !== 0) return;
            if (e.currentTarget.currentTime >= 8) advance();
          }}
        />
        <video
          ref={layerBRef}
          className={`hero-video-backdrop ${liveLayer === 1 ? 'is-live' : ''}`}
          src={layerB.src}
          poster={layerB.poster}
          muted
          loop={loopSingle && liveLayer === 1}
          playsInline
          autoPlay={playing && liveLayer === 1}
          preload="auto"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden
          onLoadedData={() => promoteLayer(1)}
          onCanPlay={() => promoteLayer(1)}
          onEnded={advance}
          onError={failAdvance}
          onTimeUpdate={(e) => {
            if (!usingLibrary || slides.length < 2 || liveLayer !== 1) return;
            if (e.currentTarget.currentTime >= 8) advance();
          }}
        />
      </div>
    </>
  );
}
