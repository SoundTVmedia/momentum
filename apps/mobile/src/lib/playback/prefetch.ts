import { shouldPrefetchFullClip } from '@shared/playback-network';

/**
 * RN has no Network Information API on iOS. Treat the native app as the 5G
 * case: fully buffer neighbors unless a future connection probe says otherwise.
 */
export function shouldPrefetchFullNativeClip(): boolean {
  return shouldPrefetchFullClip({ nativeApp: true, connection: null });
}
