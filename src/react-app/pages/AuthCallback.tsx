import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import { exchangeOAuthCodeFromUrl, readApiError } from '@/react-app/lib/oauth-client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await exchangeOAuthCodeFromUrl();
        await fetchUser();
        window.history.replaceState({}, document.title, '/auth/callback');

        const response = await apiFetch('/api/users/me');
        if (!response.ok) {
          const msg = await readApiError(
            response,
            'Signed in but could not load your account. Try again.'
          );
          setError(msg);
          return;
        }

        const userData = (await response.json()) as { profile?: unknown } | null;
        if (!userData) {
          setError('Signed in but could not load your account. Try again.');
          return;
        }

        if (userData.profile) {
          navigate('/', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        window.history.replaceState({}, document.title, '/auth/callback');
        setError('Authentication failed. Please try again.');
      }
    };

    handleCallback();
  }, [fetchUser, navigate]);

  if (error) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/auth', { replace: true })}
            className="px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Completing sign in...</p>
      </div>
    </div>
  );
}
