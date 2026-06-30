import type { PluginListenerHandle } from '@capacitor/core';

export type NativeAudioSegmentEvent = {
  mimeType: string;
  base64: string;
  byteLength: number;
};

export interface NativeAudioCapturePlugin {
  start(options?: { segmentDurationMs?: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'audioSegment',
    listenerFunc: (event: NativeAudioSegmentEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
