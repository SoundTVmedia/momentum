import { NativeModule, requireNativeModule } from 'expo-modules-core';

/** Raw payload returned by the Swift module for a Shazam catalog match. */
export type FeedbackShazamKitNativeMatch = {
  title: string | null;
  artist: string | null;
  album: string | null;
  genres: string[] | null;
  isrc: string | null;
  appleMusicId: string | null;
  appleMusicUrl: string | null;
  shazamId: string | null;
  confidence: number | null;
};

type FeedbackShazamKitModule = NativeModule & {
  /** True when the device supports ShazamKit (iOS 15+). */
  isSupported(): boolean;
  /**
   * Generate a Shazam signature from a local video/audio file and match it
   * against the Shazam catalog. Resolves null on a clean no-match; rejects
   * with coded errors (ERR_SHAZAMKIT_*) on failures.
   */
  recognizeFromFile(fileUri: string): Promise<FeedbackShazamKitNativeMatch | null>;
};

let native: FeedbackShazamKitModule | null = null;
let lookedUp = false;

/** Null on Android, web, or dev clients built before this module existed. */
export function getFeedbackShazamKitNativeModule(): FeedbackShazamKitModule | null {
  if (lookedUp) return native;
  lookedUp = true;
  try {
    native = requireNativeModule<FeedbackShazamKitModule>('FeedbackShazamKit');
  } catch {
    native = null;
  }
  return native;
}
