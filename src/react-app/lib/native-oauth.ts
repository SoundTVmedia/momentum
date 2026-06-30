/**
 * In-app OAuth for iOS Capacitor: Google via ASWebAuthenticationSession (Browser plugin)
 * and native Sign in with Apple. Avoids leaving the app in external Safari.
 */
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { Capacitor } from '@capacitor/core';
import {
  NATIVE_APP_ID,
  NATIVE_OAUTH_CALLBACK_URL,
} from '@/shared/oauth-redirect';

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}

const NATIVE_OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

type OAuthWaiter = {
  resolve: () => void;
  reject: (err: Error) => void;
};

let googleOAuthWaiter: OAuthWaiter | null = null;
let googleOAuthCompleted = false;
let nativeOAuthListenerRegistered = false;

export function shouldUseNativeInAppOAuth(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function parseNativeOAuthCallback(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${NATIVE_APP_ID}:`) {
      return null;
    }
    const path = `${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
    if (path !== 'auth/callback' && !path.endsWith('/auth/callback')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function exchangeNativeGoogleCode(code: string, state: string | null): Promise<void> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      code,
      state,
      redirect_uri: NATIVE_OAUTH_CALLBACK_URL,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Google sign-in could not be completed. Please try again.'),
    );
  }
}

async function handleNativeOAuthReturnUrl(url: string): Promise<void> {
  const parsed = parseNativeOAuthCallback(url);
  if (!parsed) {
    return;
  }

  const code = parsed.searchParams.get('code');
  const state = parsed.searchParams.get('state');
  const error = parsed.searchParams.get('error');

  try {
    await Browser.close();
  } catch {
    /* ignore */
  }

  const waiter = googleOAuthWaiter;
  googleOAuthWaiter = null;

  if (!waiter) {
    return;
  }

  try {
    if (error) {
      throw new Error(decodeURIComponent(error.replace(/\+/g, ' ')));
    }
    if (!code) {
      throw new Error('Google sign-in did not return an authorization code.');
    }
    await exchangeNativeGoogleCode(code, state);
    googleOAuthCompleted = true;
    waiter.resolve();
  } catch (err) {
    waiter.reject(err instanceof Error ? err : new Error('Google sign-in failed.'));
  }
}

export function registerNativeOAuthDeepLinkHandler(): void {
  if (!shouldUseNativeInAppOAuth() || nativeOAuthListenerRegistered) {
    return;
  }
  nativeOAuthListenerRegistered = true;

  void App.addListener('appUrlOpen', (event) => {
    void handleNativeOAuthReturnUrl(event.url);
  });
}

function waitForNativeGoogleCallback(): Promise<void> {
  return new Promise((resolve, reject) => {
    googleOAuthWaiter = { resolve, reject };
    window.setTimeout(() => {
      if (!googleOAuthWaiter) {
        return;
      }
      googleOAuthWaiter.reject(new Error('Google sign-in timed out. Please try again.'));
      googleOAuthWaiter = null;
    }, NATIVE_OAUTH_TIMEOUT_MS);
  });
}

export async function performNativeGoogleSignIn(): Promise<void> {
  registerNativeOAuthDeepLinkHandler();

  const params = new URLSearchParams({
    redirect_uri: NATIVE_OAUTH_CALLBACK_URL,
    redirect_base: NATIVE_OAUTH_CALLBACK_URL,
    native_app: '1',
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
        `${base} Register this exact URI in Google Cloud → Credentials → Authorized redirect URIs: ${body.callbackUrl}`,
      );
    }
    throw new Error(base);
  }

  const data = (await response.json()) as { redirectUrl: string };
  if (!data.redirectUrl) {
    throw new Error('OAuth redirect URL was empty');
  }

  const callbackPromise = waitForNativeGoogleCallback();
  googleOAuthCompleted = false;
  const finishedListener = await Browser.addListener('browserFinished', () => {
    if (googleOAuthCompleted || !googleOAuthWaiter) {
      return;
    }
    googleOAuthWaiter.reject(new Error('Google sign-in was cancelled.'));
    googleOAuthWaiter = null;
  });

  try {
    await Browser.open({ url: data.redirectUrl });
    await callbackPromise;
  } finally {
    await finishedListener.remove();
    try {
      await Browser.close();
    } catch {
      /* ignore */
    }
  }
}

export async function performNativeAppleSignIn(): Promise<void> {
  const redirectURI =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev';

  const result = await SignInWithApple.authorize({
    clientId: NATIVE_APP_ID,
    redirectURI,
    scopes: 'email name',
    state: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
  });

  const appleResponse = result.response;
  const response = await fetch('/api/auth/apple/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      identityToken: appleResponse.identityToken,
      authorizationCode: appleResponse.authorizationCode,
      email: appleResponse.email,
      givenName: appleResponse.givenName,
      familyName: appleResponse.familyName,
      user: appleResponse.user,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Apple sign-in could not be completed. Please try again.'),
    );
  }
}
