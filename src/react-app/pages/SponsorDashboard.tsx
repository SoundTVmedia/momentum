import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import Header from '@/react-app/components/Header';
import type { ExtendedMochaUser } from '@/shared/types';

export default function SponsorDashboardPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const isSponsor = extendedUser?.profile?.role === 'sponsor';

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
      <div className="max-w-4xl mx-auto px-4 py-14">
        <h1 className="text-3xl font-headline font-bold mb-3">Sponsor Dashboard</h1>
        {isSponsor ? (
          <div className="glass-panel rounded-2xl p-8 space-y-4">
            <p className="text-gray-300">
              Your sponsor account is active. Campaign inventory browsing by show, region, genre, and tour is coming in Phase 2.
            </p>
            <ul className="text-sm text-gray-400 list-disc pl-5 space-y-1">
              <li>Filter available creators by market and show</li>
              <li>Express campaign interest and match with approved influencers</li>
              <li>Distribute briefs with authentic placement guidelines</li>
            </ul>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-8">
            <p className="text-gray-300 mb-6">
              Sponsor dashboard access unlocks after your partnership application is approved.
            </p>
            <button
              type="button"
              onClick={() => navigate('/partner')}
              className="px-6 py-3 momentum-grad-interactive rounded-lg text-white"
            >
              Partner With Us
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
