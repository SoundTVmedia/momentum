import { useEffect, useRef } from 'react';
import HeroSearchBar from '@/react-app/components/HeroSearchBar';

/** Concert stage lights — replace with your own file at /hero/concert-lights.mp4 if preferred. */
const HERO_POSTER_URL =
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&h=1080&fit=crop';
const HERO_VIDEO_SRC =
  'https://assets.mixkit.co/videos/preview/mixkit-stage-lights-at-a-concert-4177-large.mp4';
const HERO_PLAYBACK_RATE = 0.55;

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = HERO_PLAYBACK_RATE;
    const play = () => {
      void video.play().catch(() => {});
    };
    if (video.readyState >= 2) play();
    else video.addEventListener('loadeddata', play, { once: true });
  }, []);

  return (
    <section
      className="relative z-30 overflow-x-hidden overflow-y-visible bg-black"
      aria-label="Search"
    >
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src={HERO_VIDEO_SRC}
          poster={HERO_POSTER_URL}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-momentum-teal/10 via-transparent to-purple-900/15" />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-1/4 h-56 w-56 rounded-full bg-momentum-teal/25 blur-3xl hero-light-pulse" />
        <div
          className="absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl hero-light-pulse"
          style={{ animationDelay: '1.2s' }}
        />
      </div>

      <div className="hero-scanline pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden />

      <div className="relative z-10 flex flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <HeroSearchBar />
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent"
        aria-hidden
      />
    </section>
  );
}
