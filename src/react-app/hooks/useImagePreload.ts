import { useEffect } from 'react';

/**
 * Preload images for better perceived performance
 * Useful for preloading thumbnails and avatars
 */
export function useImagePreload(urls: string[]) {
  useEffect(() => {
    if (urls.length === 0) return;

    const images: HTMLImageElement[] = [];

    urls.forEach(url => {
      if (!url) return;
      
      const img = new Image();
      img.src = url;
      images.push(img);
    });

    // Cleanup
    return () => {
      images.forEach(img => {
        img.src = '';
      });
    };
  }, [urls]);
}

/**
 * Preload next set of images when user is near the end of current list
 */
export function useNextPagePreload(thumbnails: string[], hasMore: boolean, loading: boolean) {
  useEffect(() => {
    if (!hasMore || loading || thumbnails.length === 0) return;

    // Preload the first few images from what might be the next page
    const preloadCount = Math.min(3, thumbnails.length);
    const urlsToPreload = thumbnails.slice(0, preloadCount);

    urlsToPreload.forEach(url => {
      if (!url) return;
      const img = new Image();
      img.src = url;
    });
  }, [thumbnails, hasMore, loading]);
}
