/**
 * Call only from a direct user gesture (click/tap). iOS Safari will not reliably
 * grant camera/mic when getUserMedia runs later from useEffect.
 */
export async function primeCameraOnUserGesture(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  // Prefer back camera first; `video: true` alone often opens the front camera on phones.
  const videoAttempts: (MediaTrackConstraints | boolean)[] = [
    { facingMode: { ideal: 'environment' } },
    { facingMode: { ideal: 'user' } },
    true,
  ];

  const tryOpen = (video: MediaTrackConstraints | boolean, withAudio: boolean) =>
    navigator.mediaDevices.getUserMedia({
      video,
      audio: withAudio ? audioConstraints : false,
    });

  for (const video of videoAttempts) {
    try {
      return await tryOpen(video, true);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : e instanceof Error ? e.name : '';
      if (
        name === 'NotAllowedError' ||
        name === 'NotFoundError' ||
        name === 'OverconstrainedError' ||
        name === 'AbortError'
      ) {
        try {
          return await tryOpen(video, false);
        } catch {
          /* try next video profile */
        }
      }
    }
  }
  return null;
}
