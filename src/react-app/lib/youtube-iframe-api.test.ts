import { describe, expect, it, vi } from 'vitest';
import {
  allowYoutubePictureInPicture,
  enterYoutubePictureInPicture,
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
      clientWidth: 480,
      clientHeight: 270,
      parentElement: { isConnected: true, insertBefore: vi.fn() },
      nextSibling: null,
    } as unknown as HTMLIFrameElement;

    const pipBody = { appendChild: vi.fn() };
    const pipWindow = {
      document: {
        head: { appendChild: vi.fn() },
        body: pipBody,
        createElement: () => ({ textContent: '' }),
      },
      addEventListener: vi.fn(),
    } as unknown as Window;

    const requestWindow = vi.fn(async () => pipWindow);
    vi.stubGlobal('window', { documentPictureInPicture: { requestWindow } });

    const player = fakePlayer(iframe);
    await expect(enterYoutubePictureInPicture(player)).resolves.toBe(true);
    expect(requestWindow).toHaveBeenCalledWith({ width: 480, height: 270 });
    expect(pipBody.appendChild).toHaveBeenCalledWith(iframe);
    expect(player.playVideo).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
