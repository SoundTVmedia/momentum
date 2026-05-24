/** Minimal types for the YouTube IFrame Player API (loaded at runtime). */
export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  loadVideoById: (videoId: string | { videoId: string; startSeconds?: number }) => void;
  getPlayerState: () => number;
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
      onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    };
  },
) => YTPlayer;

function isYoutubePlaying(player: YTPlayer): boolean {
  const state = player.getPlayerState?.();
  return state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
}

/** Start playback after open or swipe; starts muted for mobile policy, then unmutes when allowed. */
export function startYoutubeAutoplay(player: YTPlayer): void {
  const attempt = (unmuteAfter: boolean) => {
    if (isYoutubePlaying(player)) return;
    try {
      player.mute();
      player.playVideo();
    } catch {
      /* ignore */
    }
    if (unmuteAfter) {
      window.setTimeout(() => {
        if (!isYoutubePlaying(player)) return;
        try {
          player.unMute();
        } catch {
          /* ignore */
        }
      }, 200);
    }
  };

  attempt(false);
  for (const delay of [120, 350, 700]) {
    window.setTimeout(() => attempt(delay >= 350), delay);
  }
}

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
