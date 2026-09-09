import { registerPlugin } from '@capacitor/core';
import type { BackgroundUploadPlugin } from './definitions';

export * from './definitions';

export const BackgroundUpload = registerPlugin<BackgroundUploadPlugin>(
  'BackgroundUpload',
  {
    web: () => import('./web').then((m) => new m.BackgroundUploadWeb()),
  },
);
