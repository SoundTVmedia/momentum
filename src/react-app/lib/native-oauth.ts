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
import { AppBuildConfig, type GoogleSignInBuildConfig } from '@feedback/app-build-config';
import {
  isValidGoogleIosOAuthClientId,
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
const NATIVE_GOOGLE_SDK_TIMEOUT_MS = 2 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function refreshNativeSessionUser(): Promise<void> {
  const response = await fetch('/api/users/me', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Signed in but the session could not be loaded. Please try again.');
  }
  const data = (await response.json()) as unknown;
  if (!data) {
    throw new Error('Signed in but you still appear logged out. Please try again.');
  }
}

type OAuthWaiter = {
  resolve: () => void;
  reject: (err: Error) => void;
};

type GoogleNativeConfig = {
  enabled: boolean;
  webClientId: string | null;
  iOSClientId: string | null;
  urlScheme?: string | null;
};

let googleOAuthWaiter: OAuthWaiter | null = null;
let googleOAuthRedirectUri: string | null = null;
let googleOAuthCompleted = false;
let nativeOAuthListenerRegistered = false;
let socialLoginInitialized = false;

export function shouldUseNativeInAppOAuth(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * iOS client id compiled into this binary, or null when the binary cannot run
 * GoogleSignIn safely.
 *
 * The JS bundle comes from `server.url`, so it cannot know which binary it is
 * running in; the native plugin reads Info.plist. `cap:sync` writes GIDClientID
 * and the reversed-client-id URL scheme there from GOOGLE_IOS_OAUTH_CLIENT_ID
 * (Capacitor itself has no `ios.infoPlist` option). Without the scheme
 * GoogleSignIn throws an NSException on `signIn`, so a client id whose scheme is
 * missing is treated as "not built in".
 */
export function builtGoogleIosOAuthClientIdFromConfig(
  built: GoogleSignInBuildConfig | null | undefined,
): string | null {
  const clientId = built?.iosClientId?.trim() ?? '';
  if (!clientId || !isValidGoogleIosOAuthClientId(clientId)) {
    return null;
  }
  if (built?.urlSchemeRegistered !== true) {
    return null;
  }
  return clientId;
}

let builtGoogleClientIdPromise: Promise<string | null> | null = null;

export function readBuiltGoogleIosOAuthClientId(): Promise<string | null> {
  if (!shouldUseNativeInAppOAuth()) {
    return Promise.resolve(null);
  }
  if (!builtGoogleClientIdPromise) {
    builtGoogleClientIdPromise = AppBuildConfig.getGoogleSignInConfig()
      .then((built) => {
        const clientId = builtGoogleIosOAuthClientIdFromConfig(built);
        if (built?.iosClientId && !clientId) {
          console.warn(
            'Native Google Sign-In disabled: GIDClientID is in Info.plist but its URL scheme',
            built.urlScheme,
            'is not registered. Re-run npm run cap:sync with GOOGLE_IOS_OAUTH_CLIENT_ID set and rebuild.',
          );
        }
        return clientId;
      })
      .catch((err) => {
        // Binaries built before this plugin existed reject with "not implemented".
        console.warn('AppBuildConfig unavailable; using browser Google sign-in:', err);
        return null;
      });
  }
  return builtGoogleClientIdPromise;
}

/** The server's iOS client id must be the one compiled into this binary. */
export function nativeGoogleSdkMatchesServerConfig(
  config: GoogleNativeConfig,
  builtClientId: string | null,
): boolean {
  if (!config.enabled || !config.iOSClientId || !builtClientId) {
    return false;
  }
  return builtClientId === config.iOSClientId.trim();
}

async function readGoogleNativeConfig(): Promise<GoogleNativeConfig> {
  try {
    const response = await fetch('/api/oauth/google/native-config', {
      credentials: 'include',
    });
    if (!response.ok) {
      return { enabled: false, webClientId: null, iOSClientId: null };
    }
    const data = (await response.json()) as GoogleNativeConfig;
    if (
      !data.enabled ||
      !data.webClientId ||
      !data.iOSClientId ||
      !isValidGoogleIosOAuthClientId(data.iOSClientId)
    ) {
      return { enabled: false, webClientId: data.webClientId, iOSClientId: null };
    }
    return data;
  } catch {
    return { enabled: false, webClientId: null, iOSClientId: null };
  }
}

export async function initNativeSocialLogin(): Promise<void> {
  if (!shouldUseNativeInAppOAuth() || socialLoginInitialized) {
    return;
  }

  const [config, builtClientId] = await Promise.all([
    readGoogleNativeConfig(),
    readBuiltGoogleIosOAuthClientId(),
  ]);
  if (
    !nativeGoogleSdkMatchesServerConfig(config, builtClientId) ||
    !config.webClientId ||
    !config.iOSClientId
  ) {
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

async function exchangeNativeGoogleIdToken(
  idToken: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch('/api/auth/google/native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken, accessToken: accessToken || undefined }),
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
    await refreshNativeSessionUser();
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

function readGoogleSdkAccessToken(result: { accessToken?: unknown }): string | null {
  const access = result.accessToken;
  if (typeof access === 'string' && access.trim()) {
    return access.trim();
  }
  if (access && typeof access === 'object' && 'token' in access) {
    const token = (access as { token?: unknown }).token;
    if (typeof token === 'string' && token.trim()) {
      return token.trim();
    }
  }
  return null;
}

async function performNativeGoogleSignInWithSdk(): Promise<void> {
  await initNativeSocialLogin();
  if (!socialLoginInitialized) {
    throw new Error(
      'Native Google Sign-In is not configured. Set GOOGLE_IOS_OAUTH_CLIENT_ID on the Worker, export the same value when running npx cap sync ios, then rebuild in Xcode.',
    );
  }

  const result = await withTimeout(
    SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile', 'https://www.googleapis.com/auth/user.birthday.read'],
      },
    }),
    NATIVE_GOOGLE_SDK_TIMEOUT_MS,
    'Google sign-in timed out. Confirm the Google iOS URL scheme is in Xcode (run cap sync with GOOGLE_IOS_OAUTH_CLIENT_ID set), then try again.',
  );

  if (result.provider !== 'google' || result.result.responseType !== 'online') {
    throw new Error('Google sign-in did not return an online session.');
  }

  const idToken = result.result.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an identity token.');
  }

  const accessToken = readGoogleSdkAccessToken(result.result);
  await exchangeNativeGoogleIdToken(idToken, accessToken);
  await refreshNativeSessionUser();
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
  const [config, builtClientId] = await Promise.all([
    readGoogleNativeConfig(),
    readBuiltGoogleIosOAuthClientId(),
  ]);
  if (nativeGoogleSdkMatchesServerConfig(config, builtClientId)) {
    try {
      await performNativeGoogleSignInWithSdk();
      return;
    } catch (err) {
      console.warn('Native Google SDK sign-in failed; falling back to in-app browser:', err);
    }
  } else if (config.enabled && config.iOSClientId) {
    console.warn(
      builtClientId
        ? `Native Google SDK skipped: binary client id ${builtClientId} does not match the Worker's GOOGLE_IOS_OAUTH_CLIENT_ID. Using browser sign-in.`
        : 'Native Google SDK unavailable in this build (GOOGLE_IOS_OAUTH_CLIENT_ID was not set at cap sync). Using browser sign-in.',
    );
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
