import { registerPlugin } from '@capacitor/core';
import type { AppBuildConfigPlugin } from './definitions';

export * from './definitions';

export const AppBuildConfig = registerPlugin<AppBuildConfigPlugin>('AppBuildConfig', {
  web: () => import('./web').then((m) => new m.AppBuildConfigWeb()),
});
