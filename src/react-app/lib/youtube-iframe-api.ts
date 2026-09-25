import { enterClipPictureInPicture } from '@/react-app/lib/clip-picture-in-picture';

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
  getIframe?: () => HTMLIFrameElement;
  setSize?: (width: number, height: number) => void;
  destroy: () => void;
};

type YTPlayerConstructor = new (
  element: HTMLElement,
  options: {
    /** Omit when `element` is an iframe that already has the embed URL. */
    videoId?: string;
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

type DocumentPictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

function documentPictureInPicture(): DocumentPictureInPicture | null {
  if (typeof window === 'undefined') return null;
  const pip = (window as Window & { documentPictureInPicture?: DocumentPictureInPicture })
    .documentPictureInPicture;
  return pip?.requestWindow ? pip : null;
}

/** Let the browser float this embed. YouTube's iframe omits the permission by default. */
export function allowYoutubePictureInPicture(player: YTPlayer | null | undefined): HTMLIFrameElement | null {
  const iframe = player?.getIframe?.() ?? null;
  if (!iframe) return null;
  const allow = new Set(
    (iframe.getAttribute('allow') ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean),
  );
  allow.add('autoplay');
  allow.add('picture-in-picture');
  iframe.setAttribute('allow', [...allow].join('; '));
  return iframe;
}

/**
 * Float the YouTube embed before opening tickets or merch.
 * Moves the live iframe into a document picture-in-picture window so playback
 * continues while the shop opens. Restores the iframe when that window closes.
 */
const YOUTUBE_RESUME_DELAYS_MS = [0, 50, 200, 600];

/** YouTube's iframe API pauses when this tab hides. PiP should keep playing, like a clip. */
export function holdYoutubePlaybackWhileHidden(player: YTPlayer | null | undefined): () => void {
  if (!player || typeof document === 'undefined') return () => {};

  let stopped = false;
  const resume = () => {
    if (stopped) return;
    try {
      player.playVideo();
    } catch {
      /* player not ready */
    }
    try {
      player.getIframe?.().contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*',
      );
    } catch {
      /* cross-origin or detached */
    }
  };

  const onVisibility = () => {
    if (document.visibilityState !== 'hidden') return;
    for (const delay of YOUTUBE_RESUME_DELAYS_MS) {
      globalThis.setTimeout(resume, delay);
    }
  };

  document.addEventListener('visibilitychange', onVisibility, true);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility, true);
  };
}

function youtubeEmbedIframe(player: YTPlayer | null | undefined): HTMLIFrameElement | null {
  const fromPlayer = allowYoutubePictureInPicture(player);
  if (fromPlayer) return fromPlayer;
  if (typeof document === 'undefined') return null;
  const found = document.querySelector('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]');
  return found instanceof HTMLIFrameElement ? found : null;
}

export async function enterYoutubePictureInPicture(
  player: YTPlayer | null | undefined,
): Promise<boolean> {
  const iframe = youtubeEmbedIframe(player);
  if (!iframe) return false;

  const pip = documentPictureInPicture();
  if (pip) {
    try {
      const width = Math.max(320, Math.round(iframe.clientWidth || 480));
      const height = Math.max(180, Math.round(iframe.clientHeight || 270));
      const pipWindow = await pip.requestWindow({ width, height });
      const parent = iframe.parentElement;
      const next = iframe.nextSibling;
      const style = pipWindow.document.createElement('style');
      style.textContent = 'html,body{margin:0;height:100%;background:#000}iframe{width:100%;height:100%;border:0}';
      pipWindow.document.head.appendChild(style);
      pipWindow.document.body.appendChild(iframe);

      const releaseHold = holdYoutubePlaybackWhileHidden(player);
      const restore = () => {
        releaseHold();
        if (!parent?.isConnected) return;
        parent.insertBefore(iframe, next);
      };
      pipWindow.addEventListener('pagehide', restore, { once: true });
      try {
        player?.playVideo();
      } catch {
        /* embed keeps its current playback */
      }
      return true;
    } catch {
      /* fall through to the video element inside the embed */
    }
  }

  try {
    player?.playVideo();
  } catch {
    /* still try PiP */
  }

  try {
    const video = iframe.contentDocument?.querySelector('video');
    if (video instanceof HTMLVideoElement) {
      return enterClipPictureInPicture(video);
    }
  } catch {
    /* cross-origin embed */
  }

  return false;
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
