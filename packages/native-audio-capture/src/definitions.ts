import type { PluginListenerHandle } from '@capacitor/core';

export type NativeAudioSegmentEvent = {
  mimeType: string;
  base64: string;
  byteLength: number;
};

export interface NativeAudioCapturePlugin {
  /** Request mic permission; recover from .playback before Capgo start when needed. */
  prepareForVideoCapture(): Promise<void>;
  /** Reset when session is in .playback before Capgo start (prefer prepareForVideoCapture). */
  prepareRecordingSessionRecovery(options?: { force?: boolean }): Promise<void>;
  /** Upgrade to videoRecording while capture is running — safe before clip 2+ record. */
  prepareForRecordingCapture(): Promise<void>;
  /** Switch AVAudioSession to playback after camera capture so clip preview has audio. */
  restoreForMediaPlayback(): Promise<void>;
  start(options?: { segmentDurationMs?: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'audioSegment',
    listenerFunc: (event: NativeAudioSegmentEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
