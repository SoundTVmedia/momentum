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
  const redirectUri = oauthCallbackUrl();
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    redirect_base: redirectUri,
  });
  const response = await fetch(
    `/api/oauth/google/redirect_url?${params.toString()}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      callbackUrl?: string;
    };
    const base =
      body.error?.trim() ||
      (await readApiError(
        response,
        'Could not start Google sign-in. Check OAuth configuration in your environment.',
      ));
    if (body.callbackUrl) {
      throw new Error(
        `${base} Register this exact URI in Google Cloud → Credentials → your OAuth client → Authorized redirect URIs: ${body.callbackUrl}`,
      );
    }
    throw new Error(base);
  }
  const data = (await response.json()) as { redirectUrl: string; callbackUrl?: string };
  if (!data.redirectUrl) {
    throw new Error('OAuth redirect URL was empty');
  }
  return data.redirectUrl;
}

/** Start Sign in with Apple (Worker handles form_post callback and session cookie). */
export async function startAppleSignIn(): Promise<string> {
  const redirectBase = `${window.location.origin}`;
  const params = new URLSearchParams({
    redirect_uri: redirectBase,
    redirect_base: redirectBase,
  });
  const response = await fetch(
    `/api/oauth/apple/redirect_url?${params.toString()}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      callbackUrl?: string;
    };
    const base =
      body.error?.trim() ||
      (await readApiError(
        response,
        'Could not start Apple sign-in. Check Apple credentials in your environment.',
      ));
    if (body.callbackUrl) {
      throw new Error(
        `${base} Register this exact Return URL in Apple Developer → Services ID: ${body.callbackUrl}`,
      );
    }
    throw new Error(base);
  }
  const data = (await response.json()) as { redirectUrl: string; callbackUrl?: string };
  if (!data.redirectUrl) {
    throw new Error('Apple OAuth redirect URL was empty');
  }
  return data.redirectUrl;
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
