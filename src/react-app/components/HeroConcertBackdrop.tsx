import { useEffect, useState } from 'react';
import { HERO_STOCK_SLIDES } from '@/react-app/data/heroStockConcert';

const SLIDE_MS = 14_000;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = HERO_STOCK_SLIDES;

  useEffect(() => {
    if (reducedMotion || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, slides.length]);

  if (reducedMotion || slides.length === 1) {
    return (
      <img
        src={slides[0].poster}
        alt=""
        className="hero-concert-photo__img hero-concert-photo__img--motion"
        width={1920}
        height={720}
        decoding="async"
        fetchPriority="high"
      />
    );
  }

  return (
    <div className="hero-clip-montage hero-clip-montage--static" aria-hidden>
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`hero-clip-montage__slide ${index === activeIndex ? 'is-active' : ''}`}
        >
          <img
            src={slide.poster}
            alt=""
            className={`hero-clip-montage__media hero-clip-montage__media--kb-${index % 2}`}
            width={1920}
            height={720}
            decoding={index === 0 ? 'async' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : undefined}
          />
        </div>
      ))}
    </div>
  );
}
