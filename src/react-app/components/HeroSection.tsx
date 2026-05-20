import HeroSearchBar from '@/react-app/components/HeroSearchBar';

/** Swap these when you have brand hero video (mp4/webm) + poster. */
const HERO_POSTER_URL =
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&h=1080&fit=crop';
const HERO_VIDEO_SRC: string | null = null;

function HeroBrandMark() {
  return (
    <div className="hero-brand-mark mx-auto mb-4 sm:mb-5" aria-hidden>
      <div className="relative mx-auto h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20">
        <div className="hero-brand-ring absolute inset-0 rounded-full border border-momentum-mint/30" />
        <div className="hero-brand-ring-delay absolute inset-1 rounded-full border border-momentum-teal/20" />
        <div className="absolute inset-2 flex items-center justify-center rounded-full momentum-grad-interactive shadow-lg shadow-momentum-teal/30">
          <span className="font-headline text-2xl tracking-tight text-white sm:text-3xl">F</span>
        </div>
      </div>
      <p className="mt-3 text-center font-headline text-sm font-bold tracking-[0.35em] text-momentum-mint/90 sm:text-base">
        FEEDBACK
      </p>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section
      className="relative isolate min-h-[44vh] overflow-hidden bg-black sm:min-h-[48vh] md:min-h-[52vh] lg:min-h-[56vh]"
      aria-label="Welcome"
    >
      {/* Background — poster now; optional video layer for brand footage later */}
      <div className="absolute inset-0">
        {HERO_VIDEO_SRC ? (
          <video
            className="hero-bg-media h-full w-full object-cover"
            src={HERO_VIDEO_SRC}
            poster={HERO_POSTER_URL}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div
            className="hero-bg-media h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url('${HERO_POSTER_URL}')` }}
            role="img"
            aria-label=""
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-momentum-teal/10 via-transparent to-purple-900/15" />
      </div>

      {/* Stage lights */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-1/4 h-56 w-56 rounded-full bg-momentum-teal/25 blur-3xl hero-light-pulse" />
        <div
          className="absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl hero-light-pulse"
          style={{ animationDelay: '1.2s' }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl hero-light-pulse"
          style={{ animationDelay: '2.4s' }}
        />
      </div>

      {/* Scan line — subtle “live broadcast” feel */}
      <div className="hero-scanline pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden />

      <div className="relative z-10 flex min-h-[inherit] flex-col justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto w-full max-w-4xl text-center">
          <HeroBrandMark />

          <h1 className="font-headline text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="block momentum-grad-text">Where live</span>
            <span className="block text-white drop-shadow-lg">music lives</span>
          </h1>

          <p className="mx-auto mt-3 max-w-xl px-2 text-sm font-medium leading-relaxed text-gray-300 sm:mt-4 sm:text-base md:text-lg">
            Real clips from real shows. Find your next artist, venue, or moment.
          </p>

          <HeroSearchBar className="mt-6 sm:mt-8" />
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent"
        aria-hidden
      />
    </section>
  );
}
