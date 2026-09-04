import HeroConcertBackdrop from '@/react-app/components/HeroConcertBackdrop';

export default function HeroSection() {
  return (
    <section
      className="relative z-30 overflow-x-hidden overflow-y-visible bg-momentum-ink"
      aria-label="Where Live Music Lives"
    >
      <div className="absolute inset-0 hero-grad-base" aria-hidden />
      <div className="absolute inset-0 hero-concert-photo" aria-hidden>
        <HeroConcertBackdrop />
      </div>
      <div className="absolute inset-0 hero-concert-sweep" aria-hidden />
      <div className="absolute inset-0 hero-grad-brand" aria-hidden />
      <div className="absolute inset-0 hero-concert-scrim" aria-hidden />
      <div className="absolute inset-0 hero-concert-fade" aria-hidden />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-1/4 h-56 w-56 rounded-full bg-momentum-ember/20 blur-3xl hero-light-pulse" />
        <div
          className="absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-momentum-flare/15 blur-3xl hero-light-pulse"
          style={{ animationDelay: '1.2s' }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 h-16 w-[120%] rounded-full bg-momentum-ink/15 blur-3xl hero-light-pulse"
          style={{ animationDelay: '2.4s' }}
        />
      </div>

      <div className="relative z-10 flex min-h-[13.2rem] flex-col justify-center px-4 pt-8 pb-10 sm:min-h-[15.6rem] sm:px-6 sm:py-14 lg:min-h-[17.6rem] lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="font-headline hero-headline-grad text-center text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] leading-tight tracking-tight">
            Where Live Music Lives
          </h1>
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/80 to-transparent"
        aria-hidden
      />
    </section>
  );
}
