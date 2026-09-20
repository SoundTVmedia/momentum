import { useEffect, useRef, useState } from 'react';
import { displayMediaUrl } from '@/shared/media-proxy';
import { isNativeApp } from '@/react-app/lib/native-bridge';
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

const EMPTY_LAYER = { src: '', poster: '' };

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
  const posterRaw = resolveClipPosterUrl(clip);
  const poster = posterRaw ? displayMediaUrl(posterRaw) : '';
  const name = clip.user_display_name?.trim();
  const avatar = clip.user_avatar?.trim();
  return {
    id: typeof clip.id === 'number' ? clip.id : undefined,
    src,
    poster,
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
 * Library clips as a full-bleed backdrop. Never uses stock/placeholder media.
 * Clips hard-cut back-to-back: the next clip is preloaded on the hidden layer,
 * then swapped with visibility only.
 */
export default function HeroConcertBackdrop({
  slides = [],
  playing = true,
}: HeroConcertBackdropProps) {
  const reducedMotion = usePrefersReducedMotion();
  const postersOnly = reducedMotion || isNativeApp();
  const layerARef = useRef<HTMLVideoElement>(null);
  const layerBRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [liveLayer, setLiveLayer] = useState<0 | 1>(0);
  const [layerA, setLayerA] = useState(EMPTY_LAYER);
  const [layerB, setLayerB] = useState(EMPTY_LAYER);
  const advancingRef = useRef(false);
  const pendingSwap = useRef<0 | 1 | null>(null);
  const pendingPoster = useRef('');
  const primedRef = useRef(false);
  const [displayedPoster, setDisplayedPoster] = useState('');

  const usingLibrary = slides.length > 0;

  useEffect(() => {
    if (!usingLibrary || primedRef.current) return;
    primedRef.current = true;
    const first = slides[0];
    pendingPoster.current = first.poster;
    setDisplayedPoster(first.poster);
    setActive(0);
    setLiveLayer(0);
    setLayerA({ src: first.src, poster: first.poster });
    if (slides[1]) setLayerB({ src: slides[1].src, poster: slides[1].poster });
  }, [usingLibrary, slides]);

  const liveSrc = liveLayer === 0 ? layerA.src : layerB.src;

  useEffect(() => {
    if (postersOnly) return;
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
  }, [postersOnly, playing, liveLayer, liveSrc]);

  const promoteLayer = (layer: 0 | 1) => {
    if (pendingSwap.current !== layer) return;
    pendingSwap.current = null;
    advancingRef.current = false;
    setLiveLayer(layer);
    setDisplayedPoster(pendingPoster.current);

    if (slides.length < 2) return;
    const promotedSrc = layer === 0 ? layerA.src : layerB.src;
    const promotedIndex = slides.findIndex((slide) => slide.src === promotedSrc);
    const index = promotedIndex >= 0 ? promotedIndex : active;
    if (promotedIndex >= 0 && promotedIndex !== active) setActive(promotedIndex);
    const next = (index + 1) % slides.length;
    const hidden: 0 | 1 = layer === 0 ? 1 : 0;
    const nextSlide = slides[next];
    pendingPoster.current = nextSlide.poster;
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

  if (!usingLibrary) return null;

  if (postersOnly) {
    const poster = slides[0]?.poster;
    if (!poster) return null;
    return (
      <div className="hero-clip-montage hero-clip-montage--static">
        <div className="hero-clip-montage__slide is-active">
          <img
            src={poster}
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

  const loopSingle = slides.length === 1;

  return (
    <>
      {displayedPoster ? (
        <img
          src={displayedPoster}
          alt=""
          className="hero-concert-photo__img"
          width={1920}
          height={720}
          decoding="async"
          fetchPriority="high"
        />
      ) : null}
      <div className="hero-video-backdrop-wrap">
        {layerA.src ? (
          <video
            ref={layerARef}
            className={`hero-video-backdrop ${liveLayer === 0 ? 'is-live' : ''}`}
            src={layerA.src}
            poster={layerA.poster || undefined}
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
              if (slides.length < 2 || liveLayer !== 0) return;
              if (e.currentTarget.currentTime >= 8) advance();
            }}
          />
        ) : null}
        {layerB.src ? (
          <video
            ref={layerBRef}
            className={`hero-video-backdrop ${liveLayer === 1 ? 'is-live' : ''}`}
            src={layerB.src}
            poster={layerB.poster || undefined}
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
              if (slides.length < 2 || liveLayer !== 1) return;
              if (e.currentTarget.currentTime >= 8) advance();
            }}
          />
        ) : null}
      </div>
    </>
  );
}
