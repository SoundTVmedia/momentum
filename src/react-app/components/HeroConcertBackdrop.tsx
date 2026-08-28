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

type HeroClipSlide = {
  src: string;
  poster: string;
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

function clipToSlide(clip: ClipPlaybackFields): HeroClipSlide | null {
  if (clip.playback_unplayable) return null;
  const src = resolveFeedPreviewVideoSrc(clip);
  if (!src) return null;
  const posterRaw = resolveClipPosterUrl(clip, HERO_CONCERT_FALLBACK_IMAGE);
  return {
    src,
    poster: displayMediaUrl(posterRaw) || HERO_CONCERT_FALLBACK_IMAGE,
  };
}

export default function HeroConcertBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [slides, setSlides] = useState<HeroClipSlide[]>([]);
  const [active, setActive] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const advancingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/clips?limit=8&sort_by=trending', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { clips?: ClipPlaybackFields[] };
        const next: HeroClipSlide[] = [];
        for (const clip of data.clips ?? []) {
          const slide = clipToSlide(clip);
          if (!slide) continue;
          next.push(slide);
          if (next.length >= 6) break;
        }
        if (!cancelled && next.length > 0) {
          setSlides(next);
          setActive(0);
        }
      } catch {
        /* keep stock fallback */
      } finally {
        if (!cancelled) setLibraryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usingLibrary = slides.length > 0;
  const activeSlide = usingLibrary ? slides[active] : null;
  const videoSrc = activeSlide?.src ?? HERO_VIDEO_SRC;
  const posterSrc = activeSlide?.poster ?? HERO_CONCERT_FALLBACK_IMAGE;

  useEffect(() => {
    setVideoReady(false);
  }, [videoSrc]);

  useEffect(() => {
    if (reducedMotion) return;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      void video.play().catch(() => {
        /* Autoplay may be blocked until a user gesture elsewhere on the page */
      });
    };

    tryPlay();
    video.addEventListener('canplay', tryPlay);
    return () => video.removeEventListener('canplay', tryPlay);
  }, [reducedMotion, videoSrc]);

  const advance = () => {
    if (slides.length < 2 || advancingRef.current) return;
    advancingRef.current = true;
    setActive((i) => (i + 1) % slides.length);
  };

  useEffect(() => {
    advancingRef.current = false;
  }, [active, videoSrc]);

  if (reducedMotion) {
    const stills = usingLibrary ? slides.map((s) => s.poster) : [HERO_CONCERT_FALLBACK_IMAGE];
    return (
      <div
        className={`hero-clip-montage ${stills.length === 1 ? 'hero-clip-montage--single hero-clip-montage--static' : 'hero-clip-montage--static'}`}
      >
        {stills.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className={`hero-clip-montage__slide ${index === 0 ? 'is-active' : ''}`}
          >
            <img
              src={src}
              alt=""
              className="hero-clip-montage__media"
              width={1920}
              height={720}
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'low'}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {(!videoReady || !libraryReady) && (
        <img
          src={posterSrc}
          alt=""
          className="hero-concert-photo__img"
          width={1920}
          height={720}
          decoding="async"
          fetchPriority="high"
        />
      )}
      <div className="hero-video-backdrop-wrap">
        <video
          ref={videoRef}
          key={videoSrc}
          className={`hero-video-backdrop ${videoReady ? 'is-ready' : ''}`}
          src={videoSrc}
          poster={posterSrc}
          muted
          loop={!usingLibrary || slides.length === 1}
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onEnded={advance}
          onError={advance}
          onTimeUpdate={(e) => {
            if (!usingLibrary || slides.length < 2) return;
            if (e.currentTarget.currentTime >= 8) {
              e.currentTarget.pause();
              advance();
            }
          }}
        />
      </div>
    </>
  );
}
