export type GoogleSignInBuildConfig = {
  /** `GIDClientID` from the built Info.plist, or null when the binary has none. */
  iosClientId: string | null;
  /** Reversed-client-id URL scheme GoogleSignIn expects (`com.googleusercontent.apps.…`). */
  urlScheme: string | null;
  /**
   * True only when that scheme is present in CFBundleURLTypes. GoogleSignIn raises an
   * NSException (app crash) when `signIn` runs without it, so the native SDK path
   * must stay off unless this is true.
   */
  urlSchemeRegistered: boolean;
};

export interface AppBuildConfigPlugin {
  getGoogleSignInConfig(): Promise<GoogleSignInBuildConfig>;
}
