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
  isMuted?: () => boolean;
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

/** Start playback after open or swipe; prefer unmuted (user just tapped the card). */
export function startYoutubeAutoplay(player: YTPlayer): void {
  const unmute = () => {
    try {
      player.unMute();
    } catch {
      /* ignore */
    }
  };

  const playPreferSound = () => {
    try {
      player.unMute();
      player.playVideo();
    } catch {
      /* ignore */
    }
  };

  const playMutedThenUnmute = () => {
    try {
      player.mute();
      player.playVideo();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      if (isYoutubePlaying(player)) unmute();
    }, 250);
  };

  playPreferSound();

  for (const delay of [100, 300, 600]) {
    window.setTimeout(() => {
      if (isYoutubePlaying(player)) {
        unmute();
        return;
      }
      if (delay < 600) {
        playPreferSound();
      } else {
        playMutedThenUnmute();
      }
    }, delay);
  }
}

/** Keep modal playback unmuted once video is actually playing. */
export function ensureYoutubeUnmuted(player: YTPlayer): void {
  if (!isYoutubePlaying(player)) return;
  try {
    if (player.isMuted?.() === false) return;
    player.unMute();
  } catch {
    /* ignore */
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
