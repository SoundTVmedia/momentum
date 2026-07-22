import { WebPlugin } from '@capacitor/core';
import type { NativeAudioCapturePlugin } from './definitions';

export class NativeAudioCaptureWeb extends WebPlugin implements NativeAudioCapturePlugin {
  async prepareForVideoCapture(): Promise<void> {
    /* no-op on web */
  }

  async prepareRecordingSessionRecovery(_options?: { force?: boolean }): Promise<void> {
    /* no-op on web */
  }

  async prepareForRecordingCapture(): Promise<void> {
    /* no-op on web */
  }

  async restoreForMediaPlayback(): Promise<void> {
    /* no-op on web */
  }

  async start(): Promise<void> {
    console.warn('NativeAudioCapture: not available on web');
  }

  async stop(): Promise<void> {
    /* no-op */
  }
}
