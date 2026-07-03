import { describe, expect, it, vi } from 'vitest';
import { tryVideoPlayPreferSound } from '@/react-app/utils/videoAutoplay';

function mockVideo() {
  let muted = false;
  let paused = true;
  const play = vi.fn(async () => {
    if (play.mock.calls.length === 1 && !muted) {
      throw new DOMException('NotAllowedError');
    }
    paused = false;
  });
  return {
    volume: 1,
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
    },
    get paused() {
      return paused;
    },
    play,
  } as unknown as HTMLVideoElement;
}

describe('tryVideoPlayPreferSound', () => {
  it('prefers unmuted play', async () => {
    const video = mockVideo();
    video.play = vi.fn(async () => {
      video.muted = false;
    });
    tryVideoPlayPreferSound(video);
    await Promise.resolve();
    expect(video.muted).toBe(false);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('falls back to muted when unmuted play is blocked', async () => {
    const video = mockVideo();
    tryVideoPlayPreferSound(video);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(2);
  });

  it('respects explicit preferMuted', async () => {
    const video = mockVideo();
    video.play = vi.fn(async () => {
      /* ok */
    });
    tryVideoPlayPreferSound(video, { preferMuted: true });
    await Promise.resolve();
    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(1);
  });
});
