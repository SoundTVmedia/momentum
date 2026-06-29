import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import {
  exchangeOAuthCodeFromUrl,
  startGoogleSignIn,
} from '@/react-app/lib/oauth-client';
import GoogleSignInButton from '@/react-app/components/GoogleSignInButton';
import { Loader2, Mail, Lock, UserCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [showRememberDevice, setShowRememberDevice] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
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
          setLoading(true);
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
            const userData = await apiFetch('/api/users/me');
            if (userData.ok) {
              const data = (await userData.json()) as { profile?: unknown } | null;
              if (!data) return;
              if (data.profile) {
                navigate('/');
              } else {
                navigate('/onboarding');
              }
            }
          }
        } catch (err) {
          console.error('Device token verification failed:', err);
        } finally {
          setLoading(false);
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
        setLoading(true);
        setError(null);
        await exchangeOAuthCodeFromUrl();
        await fetchUser();
        window.history.replaceState({}, document.title, '/auth');
        setShowRememberDevice(true);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication failed. Please try again.');
        window.history.replaceState({}, document.title, '/auth');
      } finally {
        setLoading(false);
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

  const navigateAfterAuth = async (saveDevice: boolean) => {
    if (saveDevice && user) {
      try {
        const response = await fetch('/api/auth/create-device-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (response.ok) {
          const { deviceToken } = await response.json();
          const local = isLocalBrowserHostname();
          const secureAttr = local ? '' : 'secure; ';
          const sameSite = local ? 'lax' : 'strict';
          document.cookie = `${DEVICE_TOKEN_COOKIE}=${deviceToken}; path=/; max-age=${30 * 24 * 60 * 60}; ${secureAttr}samesite=${sameSite}`;
        }
      } catch (err) {
        console.error('Failed to create device token:', err);
      }
    }

    const userData = await apiFetch('/api/users/me');
    if (!userData.ok) return;
    const data = (await userData.json()) as { profile?: unknown } | null;
    if (!data) return;

    if (data.profile) {
      navigate('/');
    } else {
      navigate('/onboarding');
    }
  };

  // Logged-in users on /auth → feed (avoid racing OAuth ?code= exchange)
  useEffect(() => {
    if (user && !isPending && !showRememberDevice) {
      const code = searchParams.get('code');
      if (code) {
        return;
      }
      navigate('/');
    }
  }, [user, isPending, showRememberDevice, navigate, searchParams]);

  const startGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      window.location.href = await startGoogleSignIn();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      const hint =
        typeof window !== 'undefined' && message.includes('redirect')
          ? ` Add ${window.location.origin}/auth/callback in Google Cloud Console if it is missing.`
          : '';
      setError(message + hint);
      setLoading(false);
    }
  };

  const startAppleAuth = () => {
    // TODO: Wire up Apple OAuth on the Worker (Apple Service ID + key, token verification).
    setError('Apple sign-in is coming soon.');
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

      setShowRememberDevice(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSkipRememberDevice = async () => {
    await navigateAfterAuth(false);
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-momentum-ember animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (showRememberDevice) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-headline bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent mb-4">
              FEEDBACK
            </h1>
            <p className="text-xl text-white">Welcome back!</p>
          </div>

          <div className="glass-panel rounded-xl p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Remember this device?</h2>
              <p className="text-gray-400">Stay signed in for easy access</p>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-momentum-ember/10 border border-momentum-ember/20 rounded-lg">
              <input
                type="checkbox"
                id="rememberDeviceCheck"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-white/20 bg-white/10 text-momentum-ember focus:ring-momentum-flare focus:ring-offset-0"
              />
              <label htmlFor="rememberDeviceCheck" className="text-white cursor-pointer flex-1">
                <div className="font-semibold mb-1">Remember this device for easy sign-in</div>
                <div className="text-sm text-gray-400">
                  You&apos;ll stay logged in for 30 days. You can manage trusted devices in your
                  profile settings.
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={() => navigateAfterAuth(rememberDevice)}
              className="w-full px-6 py-4 momentum-grad-interactive rounded-xl font-bold text-white text-lg hover:scale-105 transition-transform shadow-lg shadow-momentum-ember/35"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={handleSkipRememberDevice}
              className="w-full text-gray-400 hover:text-white transition-colors text-sm"
            >
              Skip for now
            </button>
          </div>
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

        <div className="glass-panel rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Welcome</h2>
          </div>

          <div className="space-y-3">
            <GoogleSignInButton
              onClick={() => void startGoogleAuth()}
              disabled={emailLoading}
              loading={loading}
              label="Sign in with Google"
            />

            <button
              type="button"
              onClick={startAppleAuth}
              disabled={loading || emailLoading}
              className="on-light-surface w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-black hover:bg-gray-900 text-white rounded-xl font-semibold text-base shadow-md border border-white/10 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16.365 1.43c0 1.14-.417 2.2-1.114 2.99-.84.97-2.22 1.72-3.41 1.62-.14-1.12.42-2.3 1.06-3.03.72-.82 2-1.46 3.18-1.58.02.13.024.27.024.4zM20.7 17.18c-.6 1.39-.89 2-1.66 3.23-1.08 1.72-2.6 3.86-4.49 3.88-1.68.02-2.11-1.1-4.39-1.08-2.28.01-2.76 1.1-4.43 1.09-1.89-.02-3.34-1.95-4.42-3.66C-1.04 16.99-1.36 11.4 1.34 8.42 2.61 7 4.46 6.1 6.2 6.1c1.77 0 2.88 1.09 4.35 1.09 1.42 0 2.29-1.09 4.34-1.09 1.55 0 3.19.84 4.36 2.3-3.83 2.1-3.21 7.56.45 8.78z" />
              </svg>
              <span>Sign in with Apple</span>
            </button>
          </div>

          {!showEmailForm && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setEmailMode('signin');
                  setError(null);
                  setForgotMessage(null);
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                or sign in with email
              </button>
            </div>
          )}

          {showEmailForm && (
            <div className="space-y-4 pt-4 border-t border-white/10">
            {forgotMessage && (
              <div className="p-4 bg-momentum-ember/10 border border-momentum-ember/30 rounded-lg">
                <p className="text-momentum-flare text-sm">{forgotMessage}</p>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {emailMode === 'signup' && (
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
                    Display name <span className="text-gray-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How should we call you?"
                      className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare transition-colors"
                      disabled={loading || emailLoading}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare transition-colors"
                    disabled={loading || emailLoading}
                  />
                </div>
              </div>

              {emailMode !== 'forgot' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={emailMode === 'signup' ? 'At least 8 characters' : '••••••••'}
                      autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                      className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare transition-colors"
                      disabled={loading || emailLoading}
                    />
                  </div>
                </div>
              )}

              {emailMode === 'forgot' && (
                <p className="text-sm text-gray-400">
                  We&apos;ll email you a link to choose a new password if this address has an email
                  account.
                </p>
              )}

              <button
                type="submit"
                disabled={loading || emailLoading}
                className="w-full px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                {emailLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
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
              </button>
              {emailMode === 'signin' ? (
                <div className="flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('forgot');
                      setError(null);
                      setForgotMessage(null);
                    }}
                    className="text-momentum-ember hover:text-momentum-flare"
                  >
                    Forgot password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode('signup');
                      setError(null);
                      setForgotMessage(null);
                    }}
                    className="text-momentum-ember hover:text-momentum-flare"
                  >
                    Create account
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signin');
                    setError(null);
                    setForgotMessage(null);
                  }}
                  className="w-full text-center text-[11px] text-momentum-ember hover:text-momentum-flare"
                >
                  Back to sign in
                </button>
              )}
            </form>
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
