/** Deep links that should not wait on the launch splash. */
export function shouldSkipAppSplash(pathname: string): boolean {
  return (
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/reset-password') ||
    pathname.startsWith('/share/clip/')
  );
}

export const APP_SPLASH_ELEMENT_ID = 'app-splash';

/** Minimum time the launch splash stays visible so the Powered By lockup can be read. */
export const APP_SPLASH_MIN_VISIBLE_MS = 3000;

export function splashHideDelayMs(
  elapsedMs: number,
  minVisibleMs = APP_SPLASH_MIN_VISIBLE_MS,
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return minVisibleMs;
  return Math.max(0, minVisibleMs - elapsedMs);
}
