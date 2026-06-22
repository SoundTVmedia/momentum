type TryVideoPlayPreferSoundOptions = {
  onMutedChange?: (muted: boolean) => void;
  /** When set, user explicitly chose mute — autoplay must not override it. */
  preferMuted?: boolean;
};

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
    void video.play().catch(() => setMuted(prev));
  };

  if (opts?.preferMuted) {
    void attempt(true).catch(() => {});
    return;
  }

  void attempt(false).catch(() => {
    void attempt(true)
      .then(() => {
        window.setTimeout(tryUnmuteWhilePlaying, 250);
      })
      .catch(() => {});
  });
}
