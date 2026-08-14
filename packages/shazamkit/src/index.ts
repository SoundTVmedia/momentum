import { registerPlugin } from '@capacitor/core';
import type { ShazamKitPlugin } from './definitions';

export * from './definitions';

export const ShazamKit = registerPlugin<ShazamKitPlugin>('ShazamKit', {
  web: () => import('./web').then((m) => new m.ShazamKitWeb()),
});
