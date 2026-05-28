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
import {
  CLIP_CAROUSEL_GAP_CLASS,
  CLIP_CAROUSEL_ITEM_WIDTH_CLASS,
  EVENT_CAROUSEL_ITEM_WIDTH_CLASS,
  EVENT_MOBILE_CAROUSEL_ITEM_PEEK_CLASS,
  MOBILE_CAROUSEL_ITEM_PEEK_CLASS,
} from '@/react-app/lib/homeFeedLayout';

const CarouselStretchContext = createContext(false);
const CarouselFilmstripContext = createContext(false);

export type HorizontalClipCarouselProps = {
  children: ReactNode;
  /** Extra classes on the scroll viewport (e.g. negative margin to bleed within a padded card). */
  className?: string;
  ariaLabel?: string;
  /** Stretch carousel items to equal height (e.g. event cards with aligned footers). */
  stretchItems?: boolean;
  /** Perforated film-strip rail on the right edge of each clip card. */
  filmstrip?: boolean;
};

const HorizontalClipCarousel = forwardRef<HTMLDivElement, HorizontalClipCarouselProps>(
  function HorizontalClipCarousel(
    {
      children,
      className = '',
      ariaLabel = 'Clips carousel',
      stretchItems = false,
      filmstrip = false,
    },
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
  /** Tracks intended slide during smooth scroll so rapid clicks still advance. */
  const activeIndexRef = useRef(0);
  const isNavigatingRef = useRef(false);

  const getCarouselItems = useCallback((el: HTMLDivElement) => {
    return [...el.querySelectorAll<HTMLElement>('[data-carousel-item]')];
  }, []);

  /** Item whose start edge is closest to the scrollport's leading edge. */
  const getLeadingIndex = useCallback((el: HTMLDivElement, items: HTMLElement[]) => {
    if (items.length === 0) return 0;

    const scrollportLeft = el.getBoundingClientRect().left;
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < items.length; i++) {
      const distance = Math.abs(items[i].getBoundingClientRect().left - scrollportLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    return bestIndex;
  }, []);

  const applyNavState = useCallback((index: number, itemCount: number) => {
    setCanScrollLeft(index > 0);
    setCanScrollRight(index < itemCount - 1);
  }, []);

  const syncActiveIndexFromScroll = useCallback(() => {
    if (isNavigatingRef.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const items = getCarouselItems(el);
    if (items.length === 0) {
      activeIndexRef.current = 0;
      applyNavState(0, 0);
      return;
    }

    const index = getLeadingIndex(el, items);
    activeIndexRef.current = index;
    applyNavState(index, items.length);
  }, [applyNavState, getCarouselItems, getLeadingIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    syncActiveIndexFromScroll();

    const onScrollEnd = () => {
      if (isNavigatingRef.current) return;
      syncActiveIndexFromScroll();
    };

    el.addEventListener('scrollend', onScrollEnd);

    const ro = new ResizeObserver(() => syncActiveIndexFromScroll());
    ro.observe(el);

    return () => {
      el.removeEventListener('scrollend', onScrollEnd);
      ro.disconnect();
    };
  }, [syncActiveIndexFromScroll, children]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const el = scrollRef.current;
      if (!el) return;

      const items = getCarouselItems(el);
      if (items.length === 0) return;

      const targetIndex = Math.max(0, Math.min(index, items.length - 1));
      activeIndexRef.current = targetIndex;
      applyNavState(targetIndex, items.length);
      isNavigatingRef.current = true;

      items[targetIndex].scrollIntoView({
        behavior,
        inline: 'start',
        block: 'nearest',
      });

      if (behavior === 'smooth') {
        window.setTimeout(() => {
          isNavigatingRef.current = false;
          syncActiveIndexFromScroll();
        }, 450);
      } else {
        isNavigatingRef.current = false;
      }
    },
    [applyNavState, getCarouselItems, syncActiveIndexFromScroll],
  );

  const scrollByStep = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const items = getCarouselItems(el);
    if (items.length === 0) return;

    const currentIndex = activeIndexRef.current;
    const targetIndex =
      direction === 'right'
        ? Math.min(currentIndex + 1, items.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (targetIndex === currentIndex) return;

    scrollToIndex(targetIndex);
  };

  return (
    <CarouselStretchContext.Provider value={stretchItems}>
    <CarouselFilmstripContext.Provider value={filmstrip}>
    <div className={`relative group/carousel ${className}`}>
      <div
        ref={setScrollRef}
        role="region"
        aria-label={ariaLabel}
        className={`flex overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-hide snap-x snap-mandatory pb-1 max-md:scroll-ps-0 max-md:scroll-pe-4 md:px-10 md:touch-pan-x ${filmstrip ? CLIP_CAROUSEL_GAP_CLASS : 'max-md:gap-3 gap-0 md:gap-4'} ${stretchItems ? 'items-stretch' : 'items-start'}`}
      >
        {children}
      </div>

      <div className="hidden md:block absolute inset-0 z-30 pointer-events-none" aria-hidden>
        <button
          type="button"
          onClick={() => scrollByStep('left')}
          disabled={!canScrollLeft}
          className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/95 hover:border-momentum-rose/40 disabled:opacity-0 disabled:pointer-events-none -translate-x-1/2"
          aria-label="Previous clip"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => scrollByStep('right')}
          disabled={!canScrollRight}
          className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/95 hover:border-momentum-rose/40 disabled:opacity-0 disabled:pointer-events-none translate-x-1/2"
          aria-label="Next clip"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
    </CarouselFilmstripContext.Provider>
    </CarouselStretchContext.Provider>
  );
  },
);

export function useCarouselFilmstrip() {
  return useContext(CarouselFilmstripContext);
}

export default HorizontalClipCarousel;

export function HorizontalClipCarouselItem({
  children,
  className = '',
  mobilePeek = 'clip',
}: {
  children: ReactNode;
  className?: string;
  /** `event` uses a wider mobile tile so ticket buttons do not wrap. */
  mobilePeek?: 'clip' | 'event';
}) {
  const stretch = useContext(CarouselStretchContext);
  const filmstrip = useContext(CarouselFilmstripContext);
  const mobilePeekClass =
    mobilePeek === 'event' ? EVENT_MOBILE_CAROUSEL_ITEM_PEEK_CLASS : MOBILE_CAROUSEL_ITEM_PEEK_CLASS;
  const inner = stretch ? (
    <div className="flex h-full min-h-full w-full flex-col">{children}</div>
  ) : (
    children
  );

  return (
    <div
      data-carousel-item
      className={`flex-shrink-0 snap-start snap-always ${mobilePeekClass} md:basis-auto md:max-w-none ${mobilePeek === 'clip' ? CLIP_CAROUSEL_ITEM_WIDTH_CLASS : mobilePeek === 'event' ? EVENT_CAROUSEL_ITEM_WIDTH_CLASS : ''} ${filmstrip ? 'clip-carousel-item-with-filmstrip' : ''} ${stretch ? 'self-stretch flex' : 'self-start'} ${className}`}
    >
      {filmstrip ? (
        <>
          <div className="clip-filmstrip-rail clip-filmstrip-rail--left" aria-hidden>
            <div className="clip-filmstrip-sprockets" />
          </div>
          <div className="clip-filmstrip-rail clip-filmstrip-rail--right" aria-hidden>
            <div className="clip-filmstrip-sprockets" />
          </div>
        </>
      ) : null}
      {inner}
    </div>
  );
}
