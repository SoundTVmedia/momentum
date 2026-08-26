import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import {
  exchangeOAuthCodeFromUrl,
  performAppleSignIn,
  performGoogleSignIn,
} from '@/react-app/lib/oauth-client';
import { nativeIosGoogleOAuthCallbackUrl } from '@/shared/oauth-redirect';
import { shouldUseNativeInAppOAuth } from '@/react-app/lib/native-oauth';
import GoogleSignInButton from '@/react-app/components/GoogleSignInButton';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/react';

const DEVICE_TOKEN_COOKIE = 'momentum_device_token';

function clearDeviceTokenCookie() {
  const local = isLocalBrowserHostname();
  const secureAttr = local ? '' : 'secure; ';
  const sameSite = local ? 'lax' : 'strict';
  document.cookie = `${DEVICE_TOKEN_COOKIE}=; path=/; max-age=0; ${secureAttr}samesite=${sameSite}`;
}

/** Match worker `isLocalDevHost` for optional device cookies (localhost + LAN / Docker over http). */
function isLocalBrowserHostname(): boolean {
  const h = window.location.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h.endsWith('.local')
  ) {
    return true;
  }
  if (window.location.protocol !== 'http:') {
    return false;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) {
    return true;
  }
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isPending, exchangeCodeForSessionToken, fetchUser } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authModeParam = searchParams.get('mode');
  const [emailMode, setEmailMode] = useState<'signin' | 'signup' | 'forgot'>(() =>
    authModeParam === 'signup' ? 'signup' : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Restore session from device token (works for email-based accounts; OAuth users still need Google)
  useEffect(() => {
    const checkDeviceToken = async () => {
      const deviceToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith(DEVICE_TOKEN_COOKIE))
        ?.split('=')[1];

      if (deviceToken && !user) {
        try {
          setSessionBusy(true);
          const response = await apiFetch('/api/auth/verify-device-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceToken }),
          });

          if (response.ok) {
            const payload = (await response.json()) as { valid?: boolean; profile?: unknown };
            if (payload.valid === false) {
              clearDeviceTokenCookie();
              return;
            }
            try {
              await fetchUser();
            } catch {
              /* ignore */
            }
            navigate('/');
          }
        } catch (err) {
          console.error('Device token verification failed:', err);
        } finally {
          setSessionBusy(false);
        }
      }
    };

    checkDeviceToken();
  }, [user, navigate, fetchUser]);

  // OAuth return with ?code= on /auth (some redirect URI configs land here)
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      if (!code) {
        return;
      }
      try {
        setSessionBusy(true);
        setError(null);
        await exchangeOAuthCodeFromUrl();
        await fetchUser();
        window.history.replaceState({}, document.title, '/auth');
        navigate('/');
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication failed. Please try again.');
        window.history.replaceState({}, document.title, '/auth');
      } finally {
        setSessionBusy(false);
      }
    };

    handleCallback();
  }, [searchParams, exchangeCodeForSessionToken]);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setEmailMode('signup');
    } else if (mode === 'signin') {
      setEmailMode('signin');
    }
  }, [searchParams]);

  // Apple Sign in with Apple returns via Worker redirect (?apple=success).
  useEffect(() => {
    if (searchParams.get('apple') !== 'success') return;
    void (async () => {
      try {
        setSessionBusy(true);
        setError(null);
        await fetchUser();
        window.history.replaceState({}, document.title, '/auth');
        navigate('/');
      } catch (err) {
        console.error('Apple auth return error:', err);
        setError('Apple sign-in could not be completed. Please try again.');
        window.history.replaceState({}, document.title, '/auth');
      } finally {
        setSessionBusy(false);
      }
    })();
  }, [searchParams, fetchUser]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (!err || err === 'apple_missing_code') return;
    setError(decodeURIComponent(err.replace(/\+/g, ' ')));
    window.history.replaceState({}, document.title, '/auth');
  }, [searchParams]);

  // Logged-in users on /auth → feed (avoid racing OAuth ?code= exchange)
  useEffect(() => {
    if (user && !isPending) {
      const code = searchParams.get('code');
      if (code) {
        return;
      }
      navigate('/');
    }
  }, [user, isPending, navigate, searchParams]);

  const startGoogleAuth = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await performGoogleSignIn();
      if (!shouldUseNativeInAppOAuth()) {
        return;
      }
      await fetchUser();
      navigate('/');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      const hint =
        typeof window !== 'undefined' && message.includes('redirect')
          ? ` Add ${nativeIosGoogleOAuthCallbackUrl(window.location.origin)} in Google Cloud Console if it is missing.`
          : '';
      setError(message + hint);
    } finally {
      setGoogleLoading(false);
    }
  };

  const startAppleAuth = async () => {
    setError(null);
    setAppleLoading(true);
    try {
      await performAppleSignIn();
      if (!shouldUseNativeInAppOAuth()) {
        return;
      }
      await fetchUser();
      navigate('/');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Apple sign-in failed.';
      setError(message);
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (emailMode === 'forgot') {
      if (!email) {
        setError('Please enter your email address');
        return;
      }
      setEmailLoading(true);
      setError(null);
      setForgotMessage(null);
      try {
        const redirect_base =
          typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : undefined;
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, redirect_base }),
        });
        const data = (await response.json()) as { message?: string; error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'Could not send reset email');
        }
        setForgotMessage(
          data.message ||
            'If an account exists for this email, we sent password reset instructions.'
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        );
      } finally {
        setEmailLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (emailMode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setEmailLoading(true);
    setError(null);

    try {
      const path = emailMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      const body =
        emailMode === 'signup'
          ? { email, password, display_name: displayName.trim() || undefined }
          : { email, password };

      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!response.ok) {
        const msg = await readErrorMessage(
          response,
          emailMode === 'signup' ? 'Could not create account' : 'Sign in failed'
        );
        throw new Error(msg);
      }

      try {
        await fetchUser();
      } catch {
        setError('Account saved but session could not load. Try refreshing the page.');
        return;
      }

      navigate('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setEmailLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <IonSpinner className="app-spinner h-12 w-12" name="crescent" />
          <p className="text-white text-lg mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (sessionBusy) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <IonSpinner className="app-spinner h-12 w-12" name="crescent" />
          <p className="text-white text-lg mt-4">Finishing sign-in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-headline bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent mb-1">
            FEEDBACK
          </h1>
          <p className="text-sm text-gray-300">Where Live Music Lives</p>
        </div>

        <IonCard className="app-auth-card">
          <IonCardContent className="space-y-6">
          {error && (
            <IonNote color="danger" className="block rounded-lg border border-red-500/50 bg-red-500/20 p-4">
              {error}
            </IonNote>
          )}

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Welcome</h2>
          </div>

          <div className="space-y-3">
            <GoogleSignInButton
              onClick={() => void startGoogleAuth()}
              disabled={emailLoading || appleLoading}
              loading={googleLoading}
              label="Sign in with Google"
            />

            <IonButton
              expand="block"
              fill="solid"
              color="dark"
              type="button"
              onClick={() => void startAppleAuth()}
              disabled={googleLoading || appleLoading || emailLoading}
            >
              <svg className="w-5 h-5 mr-2 shrink-0 fill-white" viewBox="0 0 24 24" aria-hidden>
                <path d="M16.365 1.43c0 1.14-.417 2.2-1.114 2.99-.84.97-2.22 1.72-3.41 1.62-.14-1.12.42-2.3 1.06-3.03.72-.82 2-1.46 3.18-1.58.02.13.024.27.024.4zM20.7 17.18c-.6 1.39-.89 2-1.66 3.23-1.08 1.72-2.6 3.86-4.49 3.88-1.68.02-2.11-1.1-4.39-1.08-2.28.01-2.76 1.1-4.43 1.09-1.89-.02-3.34-1.95-4.42-3.66C-1.04 16.99-1.36 11.4 1.34 8.42 2.61 7 4.46 6.1 6.2 6.1c1.77 0 2.88 1.09 4.35 1.09 1.42 0 2.29-1.09 4.34-1.09 1.55 0 3.19.84 4.36 2.3-3.83 2.1-3.21 7.56.45 8.78z" />
              </svg>
              Sign in with Apple
            </IonButton>
          </div>

          {!showEmailForm && (
            <div className="text-center">
              <IonButton
                fill="clear"
                color="medium"
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setEmailMode('signin');
                  setError(null);
                  setForgotMessage(null);
                }}
              >
                or sign in with email
              </IonButton>
            </div>
          )}

          {showEmailForm && (
            <div className="space-y-4 pt-4 border-t border-white/10">
            {forgotMessage && (
              <IonNote color="primary" className="block rounded-lg border border-momentum-ember/30 bg-momentum-ember/10 p-4">
                {forgotMessage}
              </IonNote>
            )}

            <IonSegment
              className="app-feed-segment"
              value={emailMode}
              onIonChange={(e) => {
                const next = e.detail.value;
                if (next === 'signin' || next === 'signup' || next === 'forgot') {
                  setEmailMode(next);
                  setError(null);
                  setForgotMessage(null);
                }
              }}
            >
              <IonSegmentButton value="signin">
                <IonLabel>Sign in</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="signup">
                <IonLabel>Sign up</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="forgot">
                <IonLabel>Forgot</IonLabel>
              </IonSegmentButton>
            </IonSegment>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              {emailMode === 'signup' && (
                <IonItem lines="none" className="rounded-xl">
                  <IonInput
                    label="Display name"
                    labelPlacement="stacked"
                    type="text"
                    value={displayName}
                    placeholder="How should we call you?"
                    onIonInput={(e) => setDisplayName(e.detail.value ?? '')}
                    disabled={googleLoading || appleLoading || emailLoading}
                  />
                </IonItem>
              )}

              <IonItem lines="none" className="rounded-xl">
                <IonInput
                  label="Email Address"
                  labelPlacement="stacked"
                  type="email"
                  autocomplete="email"
                  value={email}
                  placeholder="your.email@example.com"
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                  disabled={googleLoading || appleLoading || emailLoading}
                />
              </IonItem>

              {emailMode !== 'forgot' && (
                <IonItem lines="none" className="rounded-xl">
                  <IonInput
                    label="Password"
                    labelPlacement="stacked"
                    type="password"
                    autocomplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    placeholder={emailMode === 'signup' ? 'At least 8 characters' : '••••••••'}
                    onIonInput={(e) => setPassword(e.detail.value ?? '')}
                    disabled={googleLoading || appleLoading || emailLoading}
                  />
                </IonItem>
              )}

              {emailMode === 'forgot' && (
                <p className="text-sm text-gray-400 px-1">
                  We&apos;ll email you a link to choose a new password if this address has an email
                  account.
                </p>
              )}

              <IonButton
                type="submit"
                expand="block"
                color="primary"
                disabled={googleLoading || appleLoading || emailLoading}
              >
                {emailLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <IonSpinner name="crescent" />
                    <span>
                      {emailMode === 'signup'
                        ? 'Creating account...'
                        : emailMode === 'forgot'
                          ? 'Sending link...'
                          : 'Signing in...'}
                    </span>
                  </span>
                ) : emailMode === 'signup' ? (
                  'Create account'
                ) : emailMode === 'forgot' ? (
                  'Send reset link'
                ) : (
                  'Sign in with email'
                )}
              </IonButton>
            </form>
            </div>
          )}
          </IonCardContent>
        </IonCard>

        <p className="text-center text-gray-500 text-xs mt-6">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
