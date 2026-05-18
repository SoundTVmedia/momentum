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
  return `${trimmed}${OAUTH_CALLBACK_PATH}`;
}
