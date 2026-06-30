import { registerPlugin } from '@capacitor/core';
import type { NativeAudioCapturePlugin } from './definitions';

export * from './definitions';

export const NativeAudioCapture = registerPlugin<NativeAudioCapturePlugin>(
  'NativeAudioCapture',
  {
    web: () => import('./web').then((m) => new m.NativeAudioCaptureWeb()),
  },
);
