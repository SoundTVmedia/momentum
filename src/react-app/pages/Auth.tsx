import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2, Music, Sparkles, Users, Award, Mail, Lock } from 'lucide-react';

const DEVICE_TOKEN_COOKIE = 'momentum_device_token';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isPending, redirectToLogin, exchangeCodeForSessionToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showRememberDevice, setShowRememberDevice] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  
  // Email/password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Check for device token on mount
  useEffect(() => {
    const checkDeviceToken = async () => {
      const deviceToken = document.cookie
        .split('; ')
        .find(row => row.startsWith(DEVICE_TOKEN_COOKIE))
        ?.split('=')[1];

      if (deviceToken && !user) {
        try {
          setLoading(true);
          const response = await fetch('/api/auth/verify-device-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceToken }),
          });

          if (response.ok) {
            // Device token is valid, user should be auto-logged in
            const userData = await fetch('/api/users/me');
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
  }, [user, navigate]);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      if (code) {
        try {
          setLoading(true);
          await exchangeCodeForSessionToken();

          // Show "Remember this device" checkbox after successful auth
          setShowRememberDevice(true);
          setLoading(false);
        } catch (err) {
          console.error('Auth callback error:', err);
          setError('Authentication failed. Please try again.');
          setLoading(false);
        }
      }
    };

    handleCallback();
  }, [searchParams, exchangeCodeForSessionToken]);

  // Handle device token creation after user checks the box
  useEffect(() => {
    const handleDeviceToken = async () => {
      if (showRememberDevice && rememberDevice && user) {
        try {
          const response = await fetch('/api/auth/create-device-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (response.ok) {
            const { deviceToken } = await response.json();
            // Store device token in cookie (30 days)
            document.cookie = `${DEVICE_TOKEN_COOKIE}=${deviceToken}; path=/; max-age=${30 * 24 * 60 * 60}; secure; samesite=strict`;
          }
        } catch (err) {
          console.error('Failed to create device token:', err);
        }

        // Navigate to appropriate page
        const userData = await fetch('/api/users/me');
        const data = await userData.json();

        if (data.profile) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding');
        }
      }
    };

    handleDeviceToken();
  }, [showRememberDevice, rememberDevice, user, navigate]);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user && !isPending && !showRememberDevice) {
      navigate('/dashboard');
    }
  }, [user, isPending, showRememberDevice, navigate]);

  const handleGoogleSignIn = () => {
    setLoading(true);
    setAuthMethod('google');
    redirectToLogin();
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setEmailLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sign in failed');
      }

      // Show "Remember this device" checkbox after successful auth
      setShowRememberDevice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSkipRememberDevice = async () => {
    // Skip device memory and go to dashboard/onboarding
    const userData = await fetch('/api/users/me');
    const data = await userData.json();

    if (data.profile) {
      navigate('/dashboard');
    } else {
      navigate('/onboarding');
    }
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

  // Show "Remember this device" screen after successful authentication
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
                <div className="text-sm text-gray-400">You'll stay logged in for 30 days. You can manage trusted devices in your profile settings.</div>
              </label>
            </div>

            <button
              onClick={() => setRememberDevice(true)}
              disabled={!rememberDevice}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-xl font-bold text-white text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-cyan-500/30"
            >
              Continue
            </button>

            <button
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
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-headline bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent mb-4">
            MOMENTUM
          </h1>
          <p className="text-xl text-gray-300">Where Live Music Lives</p>
        </div>

        {/* Main Card */}
        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Benefits */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Music className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Capture Live Moments</h3>
                <p className="text-gray-400 text-sm">Share clips from concerts and connect with fans worldwide</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Sparkles className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Discover Shows</h3>
                <p className="text-gray-400 text-sm">Find concerts near you and get early access to tickets</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Users className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Join the Community</h3>
                <p className="text-gray-400 text-sm">Follow artists, connect with fans, and build your profile</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Award className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold">Earn Rewards</h3>
                <p className="text-gray-400 text-sm">Get points, badges, and exclusive perks for your engagement</p>
              </div>
            </div>
          </div>

          {/* Sign In Options */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            {/* Google OAuth */}
            <button
              onClick={handleGoogleSignIn}
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

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-black/40 text-gray-400">or</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
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
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
                    disabled={loading || emailLoading}
                  />
                </div>
              </div>

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
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
                    disabled={loading || emailLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || emailLoading}
                className="w-full px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                {emailLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing In...</span>
                  </span>
                ) : (
                  'Sign In with Email'
                )}
              </button>
            </form>
          </div>

          {/* New User */}
          <div className="text-center pt-4 border-t border-white/10">
            <p className="text-gray-400 text-sm">
              New to Momentum?{' '}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading || emailLoading}
                className="text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
