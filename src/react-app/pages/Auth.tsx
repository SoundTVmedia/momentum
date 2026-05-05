import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2, Music, Sparkles, Users, Award, Mail, Lock, UserCircle } from 'lucide-react';

const DEVICE_TOKEN_COOKIE = 'momentum_device_token';

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

type OAuthProvider = 'google' | 'spotify';

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
  const [authMethod, setAuthMethod] = useState<OAuthProvider | 'email'>('google');

  const [emailMode, setEmailMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // Restore session from device token (works for email-based accounts; OAuth users still need Google/Spotify)
  useEffect(() => {
    const checkDeviceToken = async () => {
      const deviceToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith(DEVICE_TOKEN_COOKIE))
        ?.split('=')[1];

      if (deviceToken && !user) {
        try {
          setLoading(true);
          const response = await fetch('/api/auth/verify-device-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceToken }),
            credentials: 'include',
          });

          if (response.ok) {
            try {
              await fetchUser();
            } catch {
              // ignore; navigation below still attempts /api/users/me via page loads
            }
            const userData = await fetch('/api/users/me', { credentials: 'include' });
            if (userData.ok) {
              const data = await userData.json();
              if (data.profile) {
                navigate('/dashboard');
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
        await exchangeCodeForSessionToken();
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

    const userData = await fetch('/api/users/me', { credentials: 'include' });
    const data = await userData.json();

    if (data.profile) {
      navigate('/dashboard');
    } else {
      navigate('/onboarding');
    }
  };

  // Logged-in users on /auth → dashboard (avoid racing OAuth ?code= exchange)
  useEffect(() => {
    if (user && !isPending && !showRememberDevice) {
      const code = searchParams.get('code');
      if (code) {
        return;
      }
      navigate('/dashboard');
    }
  }, [user, isPending, showRememberDevice, navigate, searchParams]);

  const startOAuth = async (provider: OAuthProvider) => {
    setError(null);
    setLoading(true);
    setAuthMethod(provider);
    try {
      const params = new URLSearchParams();
      if (typeof window !== 'undefined' && window.location?.origin) {
        params.set('redirect_base', window.location.origin);
      }
      const qs = params.toString();
      const response = await fetch(
        `/api/oauth/${provider}/redirect_url${qs ? `?${qs}` : ''}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        const fallback =
          provider === 'spotify'
            ? 'Could not start Spotify sign-in.'
            : 'Could not start Google sign-in.';
        const msg = await readErrorMessage(response, fallback);
        throw new Error(msg);
      }
      const { redirectUrl } = (await response.json()) as { redirectUrl: string };
      window.location.href = redirectUrl;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setLoading(false);
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
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (showRememberDevice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-headline bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent mb-4">
              MOMENTUM
            </h1>
            <p className="text-xl text-white">Welcome back!</p>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Remember this device?</h2>
              <p className="text-gray-400">Stay signed in for easy access</p>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <input
                type="checkbox"
                id="rememberDeviceCheck"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-0"
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
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-xl font-bold text-white text-lg hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-headline bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent mb-4">
            MOMENTUM
          </h1>
          <p className="text-xl text-gray-300">Where Live Music Lives</p>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Music className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Capture Live Moments</h3>
                <p className="text-gray-400 text-sm">
                  Share clips from concerts and connect with fans worldwide
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Sparkles className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Discover Shows</h3>
                <p className="text-gray-400 text-sm">
                  Find concerts near you and get early access to tickets
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Users className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Join the Community</h3>
                <p className="text-gray-400 text-sm">
                  Follow artists, connect with fans, and build your profile
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Award className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Earn Rewards</h3>
                <p className="text-gray-400 text-sm">
                  Get points, badges, and exclusive perks for your engagement
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => startOAuth('google')}
              disabled={loading || emailLoading}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-xl font-bold text-white text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-cyan-500/30"
            >
              {loading && authMethod === 'google' ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connecting...</span>
                </span>
              ) : (
                'Sign In with Google'
              )}
            </button>

            <button
              type="button"
              onClick={() => startOAuth('spotify')}
              disabled={loading || emailLoading}
              className="w-full px-6 py-4 bg-[#1DB954] hover:bg-[#1ed760] rounded-xl font-bold text-black text-lg transition-colors disabled:opacity-50 disabled:hover:bg-[#1DB954]"
            >
              {loading && authMethod === 'spotify' ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connecting...</span>
                </span>
              ) : (
                'Sign In with Spotify'
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-black/40 text-gray-400">or continue with email</span>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">Email &amp; password</h3>
              <p className="text-gray-500 text-sm mt-1">
                One account for the app — same session as social sign-in after you land.
              </p>
            </div>

            <div className="flex rounded-lg border border-white/10 p-1 bg-black/20">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('signin');
                  setError(null);
                  setForgotMessage(null);
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                  emailMode === 'signin' || emailMode === 'forgot'
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailMode('signup');
                  setError(null);
                  setForgotMessage(null);
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                  emailMode === 'signup'
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>

            {forgotMessage && (
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-200 text-sm">{forgotMessage}</p>
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
                      className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
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
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
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
                      className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
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
              {emailMode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('forgot');
                    setError(null);
                    setForgotMessage(null);
                  }}
                  className="w-full text-center text-[11px] text-cyan-400 hover:text-cyan-300"
                >
                  Forgot Passoword
                </button>
              )}
            </form>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
