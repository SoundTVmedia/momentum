/**
 * RN has no Network Information API on iOS. Head-buffer neighbors only —
 * treating every native session as 5G kept extra decoders hot.
 */
export function shouldPrefetchFullNativeClip(): boolean {
  return false;
}
