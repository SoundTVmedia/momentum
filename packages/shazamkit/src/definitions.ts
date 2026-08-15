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
  /**
   * True on iOS 15+ builds that include the native plugin.
   * `maxSignatureSeconds` / `pluginRevision` are present on the 11s-cap
   * plugin; older TestFlight binaries only return `{ supported }`.
   */
  isSupported(): Promise<{
    supported: boolean;
    maxSignatureSeconds?: number;
    pluginRevision?: number;
  }>;
  /**
   * Recognize a song from a base64-encoded audio/video payload (wav, m4a,
   * mp4…). Resolves `{ match: null }` on a clean catalog no-match; rejects on
   * unsupported platform, malformed audio, or a failed match attempt.
   */
  recognizeAudio(options: {
    base64: string;
    mimeType?: string;
  }): Promise<{ match: ShazamKitMatchPayload | null }>;
  /**
   * Recognize a song from a local file path (file:// or absolute). Used for
   * native Capgo recordings so we do not have to base64 a 20–40MB movie.
   */
  recognizeFile(options: {
    path: string;
  }): Promise<{ match: ShazamKitMatchPayload | null }>;
}
