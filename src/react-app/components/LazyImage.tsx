import { useState, useEffect } from 'react';
import { useIntersectionObserver } from '@/react-app/hooks/useIntersectionObserver';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholderSrc?: string;
}

/**
 * Lazy loading image component with blur-up effect
 * Only loads images when they're about to enter the viewport
 */
export default function LazyImage({ src, alt, placeholderSrc, className, ...props }: LazyImageProps) {
  const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.1, freezeOnceVisible: true });
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');

  useEffect(() => {
    if (isIntersecting && src) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setIsLoaded(true);
      };
    }
  }, [isIntersecting, src]);

  return (
    <div ref={ref} className="relative overflow-hidden">
      <img
        src={currentSrc || placeholderSrc}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-50'} ${className || ''}`}
        loading="lazy"
        {...props}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse" />
      )}
    </div>
  );
}
