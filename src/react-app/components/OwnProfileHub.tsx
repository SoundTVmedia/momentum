import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Calendar, Loader2 } from 'lucide-react';
import { MY_SHOWS_PATH } from '@/react-app/lib/browse-paths';
import PointsDisplay from '@/react-app/components/PointsDisplay';
import BadgesDisplay from '@/react-app/components/BadgesDisplay';
import MyClipsSection from '@/react-app/components/MyClipsSection';
import MyPrePostClipsSection from '@/react-app/components/MyPrePostClipsSection';
import SavedClipsSection from '@/react-app/components/SavedClipsSection';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import MyGoingShowsSection from '@/react-app/components/MyGoingShowsSection';
import type { ExtendedMochaUser } from '@/shared/types';

/**
 * Signed-in profile hub: points, clips, and shows from favorite artists.
 */
type OwnProfileHubProps = {
  onOpenCapture: () => void;
};

export default function OwnProfileHub({ onOpenCapture }: OwnProfileHubProps) {
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
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Your account</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <PointsDisplay />
          <div className="lg:col-span-2">
            <BadgesDisplay compact />
          </div>
        </div>

        <div className="mb-8">
          <button
            type="button"
            onClick={() => navigate(MY_SHOWS_PATH)}
            className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-momentum-flare/30 bg-momentum-flare/10 text-momentum-flare hover:bg-momentum-flare/20 transition-colors text-sm font-medium"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            My shows — going &amp; went
          </button>
        </div>

        <div className="space-y-10">
          {user ? (
            <>
              <MyClipsSection onUploadClick={onOpenCapture} />
              <MyPrePostClipsSection onUploadClick={onOpenCapture} />
              <SavedClipsSection />
            </>
          ) : null}
          <MyGoingShowsSection variant="profile" />
          <PersonalizedConcerts />
        </div>
      </div>
    </div>
  );
}
