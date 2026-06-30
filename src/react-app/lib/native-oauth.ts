/**
 * In-app OAuth for iOS Capacitor:
 * - Google: native Google Sign-In when configured, else in-app browser + deep link
 * - Apple: native Sign in with Apple sheet
 */
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';
import {
  NATIVE_APP_ID,
  nativeIosGoogleOAuthCallbackUrl,
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

type GoogleNativeConfig = {
  enabled: boolean;
  webClientId: string | null;
  iOSClientId: string | null;
};

let googleOAuthWaiter: OAuthWaiter | null = null;
let googleOAuthRedirectUri: string | null = null;
let googleOAuthCompleted = false;
let nativeOAuthListenerRegistered = false;
let socialLoginInitialized = false;

export function shouldUseNativeInAppOAuth(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

async function readGoogleNativeConfig(): Promise<GoogleNativeConfig> {
  try {
    const response = await fetch('/api/oauth/google/native-config', {
      credentials: 'include',
    });
    if (!response.ok) {
      return { enabled: false, webClientId: null, iOSClientId: null };
    }
    return (await response.json()) as GoogleNativeConfig;
  } catch {
    return { enabled: false, webClientId: null, iOSClientId: null };
  }
}

export async function initNativeSocialLogin(): Promise<void> {
  if (!shouldUseNativeInAppOAuth() || socialLoginInitialized) {
    return;
  }

  const config = await readGoogleNativeConfig();
  if (!config.enabled || !config.webClientId || !config.iOSClientId) {
    return;
  }

  await SocialLogin.initialize({
    google: {
      webClientId: config.webClientId,
      iOSClientId: config.iOSClientId,
      iOSServerClientId: config.webClientId,
      mode: 'online',
    },
  });
  socialLoginInitialized = true;
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

async function exchangeNativeGoogleCode(
  code: string,
  state: string | null,
  redirectUri: string,
): Promise<void> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      code,
      state,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Google sign-in could not be completed. Please try again.'),
    );
  }
}

async function exchangeNativeGoogleIdToken(idToken: string): Promise<void> {
  const response = await fetch('/api/auth/google/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
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
    if (!googleOAuthRedirectUri) {
      throw new Error('Google sign-in session was lost. Please try again.');
    }
    await exchangeNativeGoogleCode(code, state, googleOAuthRedirectUri);
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

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive || !googleOAuthWaiter || googleOAuthCompleted) {
      return;
    }
    // User may have switched to YouTube for Google verification — nudge them back.
    void Browser.close().catch(() => undefined);
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

async function performNativeGoogleSignInWithSdk(): Promise<void> {
  await initNativeSocialLogin();
  if (!socialLoginInitialized) {
    throw new Error('Native Google Sign-In is not configured on the server.');
  }

  const result = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
    },
  });

  if (result.provider !== 'google' || result.result.responseType !== 'online') {
    throw new Error('Google sign-in did not return an online session.');
  }

  const idToken = result.result.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an identity token.');
  }

  await exchangeNativeGoogleIdToken(idToken);
}

async function performNativeGoogleSignInWithBrowser(): Promise<void> {
  registerNativeOAuthDeepLinkHandler();

  const appOrigin = window.location.origin;
  const googleRedirectUri = nativeIosGoogleOAuthCallbackUrl(appOrigin);
  googleOAuthRedirectUri = googleRedirectUri;

  const params = new URLSearchParams({
    redirect_uri: googleRedirectUri,
    redirect_base: appOrigin,
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
    googleOAuthWaiter.reject(
      new Error(
        'Google sign-in was cancelled. If you verified in the YouTube app, open Feedback again and retry sign-in.',
      ),
    );
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

export async function performNativeGoogleSignIn(): Promise<void> {
  const config = await readGoogleNativeConfig();
  if (config.enabled) {
    await performNativeGoogleSignInWithSdk();
    return;
  }
  await performNativeGoogleSignInWithBrowser();
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
