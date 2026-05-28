import HeroSearchBar from '@/react-app/components/HeroSearchBar';

/** Concert crowd / stage lights — blends under hero gradients (Unsplash). */
const HERO_CONCERT_IMAGE =
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920&h=720&fit=crop&q=80';

export default function HeroSection() {
  return (
    <section
      className="relative z-30 overflow-x-hidden overflow-y-visible bg-momentum-ink"
      aria-label="Search"
    >
      <div className="absolute inset-0 hero-grad-base" aria-hidden />
      <div className="absolute inset-0 hero-concert-photo" aria-hidden>
        <img
          src={HERO_CONCERT_IMAGE}
          alt=""
          className="hero-concert-photo__img"
          width={1920}
          height={720}
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <div className="absolute inset-0 hero-grad-brand" aria-hidden />
      <div className="absolute inset-0 hero-concert-scrim" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" aria-hidden />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-1/4 h-56 w-56 rounded-full bg-momentum-ember/20 blur-3xl hero-light-pulse" />
        <div
          className="absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-momentum-flare/15 blur-3xl hero-light-pulse"
          style={{ animationDelay: '1.2s' }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 h-40 w-[120%] rounded-full bg-momentum-ink/25 blur-3xl hero-light-pulse"
          style={{ animationDelay: '2.4s' }}
        />
      </div>

      <div className="relative z-10 flex flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="font-headline mb-5 text-center text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] leading-tight tracking-tight momentum-grad-text">
            Where Live Music Lives
          </h1>
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
