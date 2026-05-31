import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipWithUser } from '@/shared/types';
import {
  prefetchFeedPreviewMp4,
  resolveClipPosterUrl,
  resolveFeedPreviewVideoSrc,
} from '@/shared/clip-playback';
import { apiFetch } from '@/react-app/lib/apiFetch';

/** Fallback crowd photo when montage clips are unavailable (Unsplash). */
export const HERO_CONCERT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&h=720&fit=crop&q=85&auto=format';

const SLIDE_MS = 5_500;
const MONTAGE_CLIP_LIMIT = 8;

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

function montageReadyClips(clips: ClipWithUser[]): ClipWithUser[] {
  return clips
    .filter((clip) => resolveClipPosterUrl(clip) || resolveFeedPreviewVideoSrc(clip))
    .slice(0, MONTAGE_CLIP_LIMIT);
}

export default function HeroConcertBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const [clips, setClips] = useState<ClipWithUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const slides = useMemo(() => montageReadyClips(clips), [clips]);
  const useMontage = slides.length >= 2 && !reducedMotion;
  const activeClip = useMontage ? slides[activeIndex] : null;
  const activeVideoSrc = activeClip ? resolveFeedPreviewVideoSrc(activeClip) : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/discover/trending');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { clips?: ClipWithUser[] };
        if (!cancelled && Array.isArray(data.clips)) {
          setClips(data.clips);
        }
      } catch {
        /* keep fallback image */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!useMontage || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [useMontage, slides.length]);

  useEffect(() => {
    if (!useMontage || slides.length === 0) return;
    const next = slides[(activeIndex + 1) % slides.length];
    prefetchFeedPreviewMp4(resolveFeedPreviewVideoSrc(next));
  }, [activeIndex, slides, useMontage]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideoSrc || !useMontage) return;
    video.load();
    void video.play().catch(() => {});
  }, [activeVideoSrc, activeIndex, useMontage]);

  return (
    <>
      <img
        src={HERO_CONCERT_FALLBACK_IMAGE}
        alt=""
        className={`hero-concert-photo__img hero-concert-photo__img--motion ${
          useMontage ? 'hero-concert-photo__img--under-montage' : ''
        }`}
        width={1920}
        height={720}
        decoding="async"
        fetchPriority="high"
      />

      {useMontage ? (
        <div className="hero-clip-montage" aria-hidden>
          {slides.map((clip, index) => {
            const isActive = index === activeIndex;
            const poster = resolveClipPosterUrl(clip, HERO_CONCERT_FALLBACK_IMAGE);
            const videoSrc = resolveFeedPreviewVideoSrc(clip);
            const kenBurnsVariant = index % 3;

            return (
              <div
                key={clip.id}
                className={`hero-clip-montage__slide ${isActive ? 'is-active' : ''}`}
              >
                {isActive && videoSrc ? (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className={`hero-clip-montage__media hero-clip-montage__media--kb-${kenBurnsVariant}`}
                    poster={poster}
                    muted
                    playsInline
                    preload="auto"
                  />
                ) : (
                  <img
                    src={poster}
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
      ) : slides.length === 1 && !reducedMotion ? (
        <div className="hero-clip-montage hero-clip-montage--single" aria-hidden>
          <div className="hero-clip-montage__slide is-active">
            {resolveFeedPreviewVideoSrc(slides[0]) ? (
              <video
                ref={videoRef}
                src={resolveFeedPreviewVideoSrc(slides[0])!}
                className="hero-clip-montage__media hero-clip-montage__media--kb-0"
                poster={resolveClipPosterUrl(slides[0], HERO_CONCERT_FALLBACK_IMAGE)}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
              />
            ) : (
              <img
                src={resolveClipPosterUrl(slides[0], HERO_CONCERT_FALLBACK_IMAGE)}
                alt=""
                className="hero-clip-montage__media hero-clip-montage__media--kb-0"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
