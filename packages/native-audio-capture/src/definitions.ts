import type { PluginListenerHandle } from '@capacitor/core';

export type NativeAudioSegmentEvent = {
  mimeType: string;
  base64: string;
  byteLength: number;
};

export interface NativeAudioCapturePlugin {
  /** Request mic permission and configure AVAudioSession for Capgo video recording. */
  prepareForVideoCapture(): Promise<void>;
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
