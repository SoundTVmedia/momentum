/** Minimal types for the YouTube IFrame Player API (loaded at runtime). */
type YTPlayer = {
  playVideo: () => void;
  unMute: () => void;
  destroy: () => void;
};

type YTPlayerConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YTPlayer }) => void;
    };
  },
) => YTPlayer;

declare global {
  interface Window {
    YT?: { Player: YTPlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

export function loadYoutubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiReady) return apiReady;

  apiReady = new Promise((resolve, reject) => {
    const settle = () => {
      if (window.YT?.Player) resolve();
      else reject(new Error('YouTube IFrame API failed to load'));
    };

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      settle();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => reject(new Error('YouTube IFrame API script failed to load'));
      document.head.appendChild(tag);
    }

    queueMicrotask(() => {
      if (window.YT?.Player) resolve();
    });
  });

  return apiReady;
}

export type { YTPlayer };
