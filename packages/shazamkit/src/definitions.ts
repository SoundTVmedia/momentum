/** Normalized Shazam catalog match returned by the native iOS plugin. */
export type ShazamKitMatchPayload = {
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

export interface ShazamKitPlugin {
  /** True on iOS 15+ builds that include the native plugin. */
  isSupported(): Promise<{ supported: boolean }>;
  /**
   * Recognize a song from a base64-encoded audio/video payload (wav, m4a,
   * mp4…). Resolves `{ match: null }` on a clean catalog no-match; rejects on
   * unsupported platform, malformed audio, or a failed match attempt.
   */
  recognizeAudio(options: {
    base64: string;
    mimeType?: string;
  }): Promise<{ match: ShazamKitMatchPayload | null }>;
}
