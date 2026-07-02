/** iOS/Android Capacitor app id — also used as the native OAuth URL scheme. */
export const NATIVE_APP_ID = 'com.feedbacklive.app';

/** Canonical OAuth return path for Google + Mocha (SPA exchanges code via POST /api/sessions). */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

/**
 * HTTPS bridge for iOS in-app Google OAuth (register THIS in Google Cloud, not the custom scheme).
 * Google Web OAuth clients only allow http/https redirect URIs.
 */
export const NATIVE_IOS_OAUTH_BRIDGE_PATH = '/auth/ios-callback';

/** Deep link the iOS app receives after the HTTPS bridge redirects (not registered in Google). */
export const NATIVE_OAUTH_CALLBACK_URL = `${NATIVE_APP_ID}://${OAUTH_CALLBACK_PATH.replace(/^\//, '')}`;

export function nativeIosGoogleOAuthCallbackUrl(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, '');
  if (!trimmed) {
    return NATIVE_IOS_OAUTH_BRIDGE_PATH;
  }
  try {
    const base = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    return `${new URL(base).origin}${NATIVE_IOS_OAUTH_BRIDGE_PATH}`;
  } catch {
    return `${trimmed}${NATIVE_IOS_OAUTH_BRIDGE_PATH}`;
  }
}

export function buildNativeAppOAuthDeepLink(queryString: string): string {
  const qs = queryString.replace(/^\?/, '');
  return qs ? `${NATIVE_OAUTH_CALLBACK_URL}?${qs}` : NATIVE_OAUTH_CALLBACK_URL;
}

/** Apple Sign in with Apple posts the auth code to this Worker route (form_post). */
export const APPLE_OAUTH_CALLBACK_PATH = '/api/auth/apple/callback';

const GOOGLE_IOS_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

/** iOS OAuth client IDs end with `.apps.googleusercontent.com` (not API keys like AIzaSy…). */
export function isValidGoogleIosOAuthClientId(iosClientId: string): boolean {
  const trimmed = iosClientId.trim();
  return (
    trimmed.length > GOOGLE_IOS_CLIENT_ID_SUFFIX.length &&
    trimmed.endsWith(GOOGLE_IOS_CLIENT_ID_SUFFIX)
  );
}

export function googleIosUrlSchemeFromClientId(iosClientId: string): string | null {
  const trimmed = iosClientId.trim();
  if (!isValidGoogleIosOAuthClientId(trimmed)) {
    return null;
  }
  return `com.googleusercontent.apps.${trimmed.slice(0, -GOOGLE_IOS_CLIENT_ID_SUFFIX.length)}`;
}

export function isNativeOAuthCallbackUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith(`${NATIVE_APP_ID}://`);
}

/**
 * Ensures redirect_base points at the SPA callback route so providers return ?code= here.
 */
export function normalizeOAuthCallbackUrl(
  originOrBase: string,
  opts?: { nativeIosBridge?: boolean },
): string {
  if (opts?.nativeIosBridge) {
    return nativeIosGoogleOAuthCallbackUrl(originOrBase);
  }

  const trimmed = originOrBase.trim().replace(/\/$/, '');
  if (!trimmed) {
    return OAUTH_CALLBACK_PATH;
  }
  if (trimmed.endsWith(NATIVE_IOS_OAUTH_BRIDGE_PATH)) {
    return trimmed;
  }
  if (trimmed.endsWith(OAUTH_CALLBACK_PATH)) {
    return trimmed;
  }
  // Origin only (no path) — append callback
  if (!trimmed.includes('://') || /^https?:\/\/[^/]+$/i.test(trimmed)) {
    return `${trimmed}${OAUTH_CALLBACK_PATH}`;
  }
  return `${trimmed}${OAUTH_CALLBACK_PATH}`;
}

/** Apple OAuth callback on the Worker (form_post from Apple). */
export function resolveAppleOAuthCallbackUrl(originOrBase: string): string {
  const trimmed = originOrBase.trim().replace(/\/$/, '');
  if (!trimmed) {
    return APPLE_OAUTH_CALLBACK_PATH;
  }
  try {
    const origin = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const url = new URL(origin);
    return `${url.origin}${APPLE_OAUTH_CALLBACK_PATH}`;
  } catch {
    return APPLE_OAUTH_CALLBACK_PATH;
  }
}

/** Local dev URIs to register in Google Cloud (localhost vs 127.0.0.1 differ). */
export function localGoogleOAuthRedirectUris(port = 5173): string[] {
  return [
    `http://localhost:${port}${OAUTH_CALLBACK_PATH}`,
    `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`,
  ];
}
