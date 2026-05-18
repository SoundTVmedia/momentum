import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CarouselStretchContext = createContext(false);

export type HorizontalClipCarouselProps = {
  children: ReactNode;
  /** Extra classes on the scroll viewport (e.g. negative margin to bleed within a padded card). */
  className?: string;
  ariaLabel?: string;
  /** Stretch carousel items to equal height (e.g. event cards with aligned footers). */
  stretchItems?: boolean;
};

const HorizontalClipCarousel = forwardRef<HTMLDivElement, HorizontalClipCarouselProps>(
  function HorizontalClipCarousel(
    { children, className = '', ariaLabel = 'Clips carousel', stretchItems = false },
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

  const getActiveIndex = (items: HTMLElement[], scrollLeft: number) => {
    let index = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].offsetLeft <= scrollLeft + 16) {
        index = i;
      }
    }
    return index;
  };

  const scrollByStep = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const items = [...el.querySelectorAll<HTMLElement>('[data-carousel-item]')];
    if (items.length === 0) return;

    const activeIndex = getActiveIndex(items, el.scrollLeft);
    const targetIndex =
      direction === 'right'
        ? Math.min(activeIndex + 1, items.length - 1)
        : Math.max(activeIndex - 1, 0);

    el.scrollTo({ left: items[targetIndex].offsetLeft, behavior: 'smooth' });
  };

  return (
    <CarouselStretchContext.Provider value={stretchItems}>
    <div className={`relative group/carousel ${className}`}>
      <div
        ref={setScrollRef}
        role="region"
        aria-label={ariaLabel}
        className={`flex gap-0 md:gap-4 overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-hide snap-x snap-mandatory pb-1 md:px-10 md:touch-pan-x ${stretchItems ? 'items-stretch' : 'items-start'}`}
      >
        {children}
      </div>

      <div className="hidden md:block absolute inset-0 z-30 pointer-events-none" aria-hidden>
        <button
          type="button"
          onClick={() => scrollByStep('left')}
          disabled={!canScrollLeft}
          className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/95 hover:border-purple-400/40 disabled:opacity-0 disabled:pointer-events-none -translate-x-1/2"
          aria-label="Previous clip"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => scrollByStep('right')}
          disabled={!canScrollRight}
          className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/95 hover:border-purple-400/40 disabled:opacity-0 disabled:pointer-events-none translate-x-1/2"
          aria-label="Next clip"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
    </CarouselStretchContext.Provider>
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
  const stretch = useContext(CarouselStretchContext);
  return (
    <div
      data-carousel-item
      className={`flex-shrink-0 basis-full w-full max-w-full snap-start snap-always max-md:mr-3 max-md:last:mr-0 md:mr-0 md:basis-auto md:w-72 lg:w-80 ${stretch ? 'self-stretch flex' : 'self-start'} ${className}`}
    >
      {stretch ? <div className="flex h-full min-h-full w-full flex-col">{children}</div> : children}
    </div>
  );
}
