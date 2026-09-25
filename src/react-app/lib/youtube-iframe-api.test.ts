import { describe, expect, it, vi } from 'vitest';
import {
  allowYoutubePictureInPicture,
  enterYoutubePictureInPicture,
  holdYoutubePlaybackWhileHidden,
  type YTPlayer,
} from './youtube-iframe-api';

function fakePlayer(iframe: HTMLIFrameElement): YTPlayer {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    mute: vi.fn(),
    unMute: vi.fn(),
    loadVideoById: vi.fn(),
    getPlayerState: () => 1,
    getIframe: () => iframe,
    destroy: vi.fn(),
  };
}

describe('allowYoutubePictureInPicture', () => {
  it('adds the picture-in-picture permission on the embed iframe', () => {
    let allow = 'autoplay; fullscreen';
    const iframe = {
      getAttribute: () => allow,
      setAttribute: (_name: string, value: string) => {
        allow = value;
      },
    } as unknown as HTMLIFrameElement;

    allowYoutubePictureInPicture(fakePlayer(iframe));
    expect(allow).toContain('picture-in-picture');
  });
});

describe('enterYoutubePictureInPicture', () => {
  it('moves the live iframe into a picture-in-picture window', async () => {
    const iframe = {
      allow: '',
      getAttribute: () => '',
      setAttribute: vi.fn(),
      contentDocument: null,
      contentWindow: { postMessage: vi.fn() },
      clientWidth: 480,
      clientHeight: 270,
      parentElement: { isConnected: true, insertBefore: vi.fn() },
      nextSibling: null,
    } as unknown as HTMLIFrameElement;

    const pipBody = { appendChild: vi.fn() };
    let onPageHide: (() => void) | undefined;
    const pipWindow = {
      document: {
        head: { appendChild: vi.fn() },
        body: pipBody,
        createElement: () => ({ textContent: '' }),
      },
      addEventListener: vi.fn((type: string, handler: () => void) => {
        if (type === 'pagehide') onPageHide = handler;
      }),
    } as unknown as Window;

    const requestWindow = vi.fn(async () => pipWindow);
    vi.stubGlobal('window', { documentPictureInPicture: { requestWindow } });

    const player = fakePlayer(iframe);
    await expect(enterYoutubePictureInPicture(player)).resolves.toBe(true);
    expect(requestWindow).toHaveBeenCalledWith({ width: 480, height: 270 });
    expect(pipBody.appendChild).toHaveBeenCalledWith(iframe);
    expect(player.playVideo).toHaveBeenCalled();

    onPageHide?.();
    vi.unstubAllGlobals();
  });
});

describe('holdYoutubePlaybackWhileHidden', () => {
  it('resumes playback when the tab hides so picture-in-picture keeps playing', () => {
    vi.useFakeTimers();
    let visibilityState = 'visible';
    const listeners = new Set<() => void>();
    vi.stubGlobal('document', {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener: (_type: string, handler: () => void) => {
        listeners.add(handler);
      },
      removeEventListener: (_type: string, handler: () => void) => {
        listeners.delete(handler);
      },
    });

    const player = fakePlayer({ contentWindow: { postMessage: vi.fn() } } as unknown as HTMLIFrameElement);
    const release = holdYoutubePlaybackWhileHidden(player);

    for (const listener of listeners) listener();
    vi.runAllTimers();
    expect(player.playVideo).not.toHaveBeenCalled();

    visibilityState = 'hidden';
    for (const listener of listeners) listener();
    vi.runAllTimers();
    expect(player.playVideo).toHaveBeenCalled();

    release();
    vi.mocked(player.playVideo).mockClear();
    for (const listener of listeners) listener();
    vi.runAllTimers();
    expect(player.playVideo).not.toHaveBeenCalled();

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
