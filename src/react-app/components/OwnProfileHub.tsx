import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2 } from 'lucide-react';
import PointsDisplay from '@/react-app/components/PointsDisplay';
import BadgesDisplay from '@/react-app/components/BadgesDisplay';
import MyClipsSection from '@/react-app/components/MyClipsSection';
import SavedClipsSection from '@/react-app/components/SavedClipsSection';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
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

        if (!data.profile) {
          navigate('/onboarding');
          return;
        }

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

        <div className="space-y-10">
          {user ? (
            <>
              <MyClipsSection onUploadClick={onOpenCapture} />
              <SavedClipsSection />
            </>
          ) : null}
          <PersonalizedConcerts />
        </div>
      </div>
    </div>
  );
}
