import HeroSearchBar from '@/react-app/components/HeroSearchBar';

export default function HeroSection() {
  return (
    <section
      className="relative z-30 overflow-x-hidden overflow-y-visible bg-[#041210]"
      aria-label="Search"
    >
      <div className="absolute inset-0 hero-grad-base" aria-hidden />
      <div className="absolute inset-0 hero-grad-brand" aria-hidden />
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
