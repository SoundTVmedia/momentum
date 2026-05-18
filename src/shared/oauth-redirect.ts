/** Canonical OAuth return path for this SPA (Google + Mocha). */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

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

/** Local dev URIs to register in Google Cloud (localhost vs 127.0.0.1 differ). */
export function localGoogleOAuthRedirectUris(port = 5173): string[] {
  return [
    `http://localhost:${port}${OAUTH_CALLBACK_PATH}`,
    `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`,
  ];
}
