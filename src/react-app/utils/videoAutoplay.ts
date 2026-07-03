type TryVideoPlayPreferSoundOptions = {
  onMutedChange?: (muted: boolean) => void;
  /** When set, user explicitly chose mute — autoplay must not override it. */
  preferMuted?: boolean;
  /** iOS: restore AVAudioSession after camera capture before playback. */
  restoreAudioSession?: () => Promise<void>;
};

function isMobilePlaybackPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
}

/** User-gesture play — prefer sound; fall back to muted if the browser blocks audio. */
export async function playVideoWithSoundOnGesture(
  video: HTMLVideoElement,
  opts?: TryVideoPlayPreferSoundOptions,
): Promise<boolean> {
  if (opts?.restoreAudioSession) {
    try {
      await opts.restoreAudioSession();
    } catch {
      /* ignore */
    }
  }
  video.volume = 1;
  video.muted = false;
  opts?.onMutedChange?.(false);
  try {
    await video.play();
    return true;
  } catch {
    video.muted = true;
    opts?.onMutedChange?.(true);
    try {
      await video.play();
      return true;
    } catch {
      return false;
    }
  }
}

/** Attempt play with sound first; fall back to muted, then retry unmute while playing. */
export function tryVideoPlayPreferSound(
  video: HTMLVideoElement,
  opts?: TryVideoPlayPreferSoundOptions,
): void {
  const setMuted = (muted: boolean) => {
    video.muted = muted;
    opts?.onMutedChange?.(muted);
  };

  const attempt = (muted: boolean) => {
    setMuted(muted);
    return video.play();
  };

  const tryUnmuteWhilePlaying = () => {
    if (video.paused || opts?.preferMuted) return;
    const prev = video.muted;
    setMuted(false);
    video.volume = 1;
    void video.play().catch(() => setMuted(prev));
  };

  if (opts?.preferMuted) {
    void attempt(true).catch(() => {});
    return;
  }

  const run = async () => {
    video.volume = 1;
    try {
      await attempt(false);
    } catch {
      await attempt(true);
      if (!isMobilePlaybackPlatform()) {
        window.setTimeout(tryUnmuteWhilePlaying, 250);
      }
    }
  };

  void run();
}
