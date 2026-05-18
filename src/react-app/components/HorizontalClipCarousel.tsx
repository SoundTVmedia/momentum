import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type HorizontalClipCarouselProps = {
  children: ReactNode;
  /** Extra classes on the scroll viewport (e.g. negative margin to bleed within a padded card). */
  className?: string;
  ariaLabel?: string;
};

const HorizontalClipCarousel = forwardRef<HTMLDivElement, HorizontalClipCarouselProps>(
  function HorizontalClipCarousel(
    { children, className = '', ariaLabel = 'Clips carousel' },
    forwardedRef,
  ) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [updateScrollState, children]);

  const scrollByStep = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const items = el.querySelectorAll<HTMLElement>('[data-carousel-item]');
    if (items.length === 0) return;

    const { scrollLeft } = el;
    const offsets = [...items].map((item) => item.offsetLeft);

    if (direction === 'right') {
      const next = offsets.find((left) => left > scrollLeft + 4);
      el.scrollTo({ left: next ?? offsets[offsets.length - 1], behavior: 'smooth' });
      return;
    }

    const prev = [...offsets].reverse().find((left) => left < scrollLeft - 4);
    el.scrollTo({ left: prev ?? 0, behavior: 'smooth' });
  };

  return (
    <div className={`relative group/carousel ${className}`}>
      <button
        type="button"
        onClick={() => scrollByStep('left')}
        disabled={!canScrollLeft}
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/95 hover:border-purple-400/40 disabled:opacity-0 disabled:pointer-events-none -translate-x-1/2"
        aria-label="Previous clip"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={() => scrollByStep('right')}
        disabled={!canScrollRight}
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/95 hover:border-purple-400/40 disabled:opacity-0 disabled:pointer-events-none translate-x-1/2"
        aria-label="Next clip"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <div
        ref={setScrollRef}
        role="region"
        aria-label={ariaLabel}
        className="flex items-start gap-0 md:gap-4 overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-hide snap-x snap-mandatory pb-1 md:px-10 md:touch-pan-x"
      >
        {children}
      </div>

      <div
        className="hidden md:block pointer-events-none absolute inset-y-0 left-0 z-20 w-14 lg:w-20 bg-gradient-to-r from-black/80 via-black/40 to-transparent opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        aria-hidden
      />
      <div
        className="hidden md:block pointer-events-none absolute inset-y-0 right-0 z-20 w-14 lg:w-20 bg-gradient-to-l from-black/80 via-black/40 to-transparent opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        aria-hidden
      />
    </div>
  );
  },
);

export default HorizontalClipCarousel;

export function HorizontalClipCarouselItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-carousel-item
      className={`flex-shrink-0 self-start basis-full w-full max-w-full snap-start snap-always max-md:mr-3 max-md:last:mr-0 md:mr-0 md:basis-auto md:w-72 lg:w-80 ${className}`}
    >
      {children}
    </div>
  );
}
