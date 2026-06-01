import { useEffect, useRef, useState } from 'react';
import {
  HERO_CONCERT_FALLBACK_IMAGE,
  HERO_VIDEO_SRC,
} from '@/react-app/data/heroStockConcert';

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

export default function HeroConcertBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

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
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <img
        src={HERO_CONCERT_FALLBACK_IMAGE}
        alt=""
        className="hero-concert-photo__img"
        width={1920}
        height={720}
        decoding="async"
        fetchPriority="high"
      />
    );
  }

  return (
    <>
      {!videoReady && (
        <img
          src={HERO_CONCERT_FALLBACK_IMAGE}
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
          className={`hero-video-backdrop ${videoReady ? 'is-ready' : ''}`}
          src={HERO_VIDEO_SRC}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          aria-hidden
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
        />
      </div>
    </>
  );
}
