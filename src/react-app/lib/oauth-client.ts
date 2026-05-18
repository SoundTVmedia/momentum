import { OAUTH_CALLBACK_PATH } from '@/shared/oauth-redirect';

export function oauthCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return OAUTH_CALLBACK_PATH;
  }
  return `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}

/** Start Google OAuth (Mocha Users Service or direct Google credentials on the Worker). */
export async function startGoogleSignIn(): Promise<string> {
  const redirectBase = oauthCallbackUrl();
  const response = await fetch(
    `/api/oauth/google/redirect_url?redirect_base=${encodeURIComponent(redirectBase)}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        'Could not start Google sign-in. Check OAuth configuration in your environment.',
      ),
    );
  }
  const { redirectUrl } = (await response.json()) as { redirectUrl: string };
  if (!redirectUrl) {
    throw new Error('OAuth redirect URL was empty');
  }
  return redirectUrl;
}

/** Exchange ?code= from /auth/callback for an httpOnly session cookie. */
export async function exchangeOAuthCodeFromUrl(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) {
    throw new Error('Missing authorization code in callback URL');
  }

  const state = params.get('state');
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      code,
      ...(state ? { state } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Google sign-in could not be completed. Please try again.'),
    );
  }
}
