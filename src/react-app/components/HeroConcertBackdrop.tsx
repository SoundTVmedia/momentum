import { useEffect, useRef, useState } from 'react';
import {
  HERO_CONCERT_FALLBACK_IMAGE,
  HERO_YOUTUBE_POSTER,
  HERO_YOUTUBE_VIDEO_ID,
} from '@/react-app/data/heroStockConcert';
import {
  loadYoutubeIframeApi,
  YT_PLAYER_STATE,
  type YTPlayer,
} from '@/react-app/lib/youtube-iframe-api';

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
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [posterSrc, setPosterSrc] = useState(HERO_YOUTUBE_POSTER);

  useEffect(() => {
    if (reducedMotion) return;

    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    const mountPlayer = async () => {
      try {
        await loadYoutubeIframeApi();
      } catch {
        return;
      }
      if (cancelled || !hostRef.current || !window.YT?.Player) return;

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId: HERO_YOUTUBE_VIDEO_ID,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          loop: 1,
          playlist: HERO_YOUTUBE_VIDEO_ID,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event) => {
            try {
              event.target.mute();
              event.target.playVideo();
            } catch {
              /* ignore */
            }
            if (!cancelled) setVideoReady(true);
          },
          onStateChange: (event) => {
            if (event.data === YT_PLAYER_STATE.ENDED) {
              try {
                event.target.playVideo();
              } catch {
                /* ignore */
              }
            }
          },
        },
      });
    };

    void mountPlayer();

    return () => {
      cancelled = true;
      setVideoReady(false);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [reducedMotion]);

  const showYoutube = !reducedMotion;

  return (
    <>
      <img
        src={posterSrc}
        alt=""
        className={`hero-concert-photo__img hero-concert-photo__img--motion ${
          videoReady && showYoutube ? 'hero-concert-photo__img--under-montage' : ''
        }`}
        width={1920}
        height={720}
        decoding="async"
        fetchPriority="high"
        onError={() => {
          if (posterSrc !== HERO_CONCERT_FALLBACK_IMAGE) {
            setPosterSrc(HERO_CONCERT_FALLBACK_IMAGE);
          }
        }}
      />

      {showYoutube ? (
        <div
          className={`hero-youtube-backdrop ${videoReady ? 'is-ready' : ''}`}
          aria-hidden
        >
          <div ref={hostRef} className="hero-youtube-backdrop__player" />
        </div>
      ) : null}
    </>
  );
}
