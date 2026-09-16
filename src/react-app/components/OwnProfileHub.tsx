import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Calendar, LifeBuoy, Loader2, MapPin, Music, Shield } from 'lucide-react';
import { MY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import PointsDisplay from '@/react-app/components/PointsDisplay';
import BadgesDisplay from '@/react-app/components/BadgesDisplay';
import MyClipsSection from '@/react-app/components/MyClipsSection';
import SavedClipsSection from '@/react-app/components/SavedClipsSection';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import MyGoingShowsSection from '@/react-app/components/MyGoingShowsSection';
import type { ExtendedMochaUser } from '@/shared/types';
import { isAdminUser } from '@/react-app/lib/program-nav';

/**
 * Signed-in profile hub: points, clips, and shows from favorite artists.
 */
type OwnProfileHubProps = {
  onOpenCapture: () => void;
  children?: ReactNode;
};

export default function OwnProfileHub({ onOpenCapture, children }: OwnProfileHubProps) {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [userData, setUserData] = useState<ExtendedMochaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/users/me');
        const data = await response.json();

        setUserData(data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!isPending) {
      void fetchUserData();
    }
  }, [user, isPending, navigate]);

  if (isPending || loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (!userData?.profile) {
    return null;
  }

  return (
    <div className="mb-10">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6 mb-10">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Your Account</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <PointsDisplay />
          <div className="lg:col-span-2">
            <BadgesDisplay compact />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/artist-hub')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <Music className="w-4 h-4 shrink-0" />
            Artist Hub
          </button>
          <button
            type="button"
            onClick={() => navigate('/venue-hub')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            Venue Hub
          </button>
          <button
            type="button"
            onClick={() => navigate(MY_SHOWS_PATH)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            My Shows
          </button>
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <LifeBuoy className="w-4 h-4 shrink-0" />
            Help &amp; Support
          </button>
          {isAdminUser(userData) ? (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="admin-header-control w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full border border-momentum-rose/40 bg-momentum-rose/10 text-momentum-rose hover:bg-momentum-rose/20 transition-colors text-sm font-medium"
            >
              <Shield className="w-4 h-4 shrink-0" />
              Admin dashboard
            </button>
          ) : null}
        </div>
      </div>

      {children}

      <div className="space-y-10">
        {user ? (
          <>
            <MyClipsSection onUploadClick={onOpenCapture} />
            <SavedClipsSection />
          </>
        ) : null}
        <MyGoingShowsSection variant="profile" />
        <PersonalizedConcerts />
      </div>
    </div>
  );
}
