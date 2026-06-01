import { useEffect, useRef, useState } from 'react';
import {
  HERO_CONCERT_FALLBACK_IMAGE,
  HERO_STOCK_SLIDES,
  HERO_STOCK_VIDEO_PLAYBACK_RATE,
} from '@/react-app/data/heroStockConcert';

const SLIDE_MS = 8_000;

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

function prefetchHeroVideo(src: string) {
  if (!src) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'video';
  link.href = src;
  document.head.appendChild(link);
}

export default function HeroConcertBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const useVideoMontage = !reducedMotion;
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const slides = HERO_STOCK_SLIDES;
  const activeSlide = slides[activeIndex];
  const activeVideoSrc = useVideoMontage ? activeSlide?.videoSrc : null;

  useEffect(() => {
    if (!useVideoMontage || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [useVideoMontage, slides.length]);

  useEffect(() => {
    if (!useVideoMontage) return;
    const next = slides[(activeIndex + 1) % slides.length];
    prefetchHeroVideo(next.videoSrc);
  }, [activeIndex, slides, useVideoMontage]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoSrc || !useVideoMontage) return;
    video.playbackRate = HERO_STOCK_VIDEO_PLAYBACK_RATE;
    video.load();
    void video.play().catch(() => {});
  }, [activeVideoSrc, activeIndex, useVideoMontage]);

  return (
    <>
      <img
        src={HERO_CONCERT_FALLBACK_IMAGE}
        alt=""
        className={`hero-concert-photo__img hero-concert-photo__img--motion ${
          useVideoMontage ? 'hero-concert-photo__img--under-montage' : ''
        }`}
        width={1920}
        height={720}
        decoding="async"
        fetchPriority="high"
      />

      {useVideoMontage ? (
        <div className="hero-clip-montage" aria-hidden>
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            const kenBurnsVariant = index % 3;

            return (
              <div
                key={slide.id}
                className={`hero-clip-montage__slide ${isActive ? 'is-active' : ''}`}
              >
                {isActive ? (
                  <video
                    ref={videoRef}
                    src={slide.videoSrc}
                    className={`hero-clip-montage__media hero-clip-montage__media--kb-${kenBurnsVariant}`}
                    poster={slide.poster}
                    muted
                    loop
                    playsInline
                    preload="auto"
                  />
                ) : (
                  <img
                    src={slide.poster}
                    alt=""
                    className={`hero-clip-montage__media hero-clip-montage__media--kb-${kenBurnsVariant}`}
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
