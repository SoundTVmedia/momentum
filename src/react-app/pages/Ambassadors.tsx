import { useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import Header from '@/react-app/components/Header';
import AmbassadorDashboard from '@/react-app/components/dashboards/AmbassadorDashboard';
import type { ExtendedMochaUser } from '@/shared/types';

export default function AmbassadorsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, isPending, navigate]);

  if (isPending || !user) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to feed</span>
        </button>

        <AmbassadorDashboard user={user as ExtendedMochaUser} />
      </div>
    </div>
  );
}
