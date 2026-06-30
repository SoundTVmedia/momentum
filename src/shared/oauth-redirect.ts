/** Canonical OAuth return path for Google + Mocha (SPA exchanges code via POST /api/sessions). */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

/** Apple Sign in with Apple posts the auth code to this Worker route (form_post). */
export const APPLE_OAUTH_CALLBACK_PATH = '/api/auth/apple/callback';

/**
 * Ensures redirect_base points at the SPA callback route so providers return ?code= here.
 */
export function normalizeOAuthCallbackUrl(originOrBase: string): string {
  const trimmed = originOrBase.trim().replace(/\/$/, '');
  if (!trimmed) {
    return OAUTH_CALLBACK_PATH;
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
