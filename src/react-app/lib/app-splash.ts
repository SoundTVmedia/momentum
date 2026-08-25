/** Deep links that should not wait on the launch splash. */
export function shouldSkipAppSplash(pathname: string): boolean {
  return (
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/reset-password') ||
    pathname.startsWith('/share/clip/')
  );
}

export const APP_SPLASH_ELEMENT_ID = 'app-splash';
