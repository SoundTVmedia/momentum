import { NativeModule, requireNativeModule } from 'expo-modules-core';

type FeedbackAudioSessionModule = NativeModule & {
  prepareForVideoCapture(): Promise<void>;
  prepareRecordingSessionRecovery(): Promise<void>;
  restoreForMediaPlayback(): Promise<void>;
};

let native: FeedbackAudioSessionModule | null = null;

function getNative(): FeedbackAudioSessionModule | null {
  if (native) return native;
  try {
    native = requireNativeModule<FeedbackAudioSessionModule>('FeedbackAudioSession');
    return native;
  } catch {
    return null;
  }
}

/** Mic permission + optional recovery from .playback before camera start. */
export async function prepareForVideoCapture(): Promise<void> {
  const mod = getNative();
  if (!mod) {
    // Dev client without native module yet — permission will be requested by vision-camera.
    return;
  }
  await mod.prepareForVideoCapture();
}

/** Reset AVAudioSession when stuck in .playback before the next capture. */
export async function prepareRecordingSessionRecovery(): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  await mod.prepareRecordingSessionRecovery();
}

/**
 * Switch to playback after camera so caption/feed video has audio.
 * Never deactivates the session (matches Capacitor NativeAudioCapture).
 */
export async function restoreForMediaPlayback(): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  await mod.restoreForMediaPlayback();
}
