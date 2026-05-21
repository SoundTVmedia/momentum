import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2, Settings } from 'lucide-react';
import PointsDisplay from '@/react-app/components/PointsDisplay';
import BadgesDisplay from '@/react-app/components/BadgesDisplay';
import DeviceManagement from '@/react-app/components/DeviceManagement';
import MyClipsSection from '@/react-app/components/MyClipsSection';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import FanDashboard from '@/react-app/components/dashboards/FanDashboard';
import ArtistDashboard from '@/react-app/components/dashboards/ArtistDashboard';
import AmbassadorDashboard from '@/react-app/components/dashboards/AmbassadorDashboard';
import InfluencerDashboard from '@/react-app/components/dashboards/InfluencerDashboard';
import type { ExtendedMochaUser } from '@/shared/types';

/**
 * Dashboard-style sections for the signed-in user on their own profile page
 * (points, personalization, role tools, etc.).
 */
type OwnProfileHubProps = {
  onOpenCapture: () => void;
};

export default function OwnProfileHub({ onOpenCapture }: OwnProfileHubProps) {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [userData, setUserData] = useState<ExtendedMochaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);

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

  const renderRoleDashboard = () => {
    switch (userData.profile?.role) {
      case 'fan':
        return <FanDashboard user={userData} onDropClip={onOpenCapture} />;
      case 'artist':
      case 'venue':
        return <ArtistDashboard user={userData} onDropClip={onOpenCapture} />;
      case 'ambassador':
        return <AmbassadorDashboard user={userData} onDropClip={onOpenCapture} />;
      case 'influencer':
        return <InfluencerDashboard user={userData} onDropClip={onOpenCapture} />;
      case 'premium':
        return <FanDashboard user={userData} onDropClip={onOpenCapture} />;
      default:
        return <FanDashboard user={userData} onDropClip={onOpenCapture} />;
    }
  };

  return (
    <div className="mb-12 space-y-10">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Your account</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <PointsDisplay />
          <div className="lg:col-span-2">
            <BadgesDisplay compact />
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <button
            type="button"
            onClick={() => setShowDeviceManagement(!showDeviceManagement)}
            className="flex items-center space-x-2 text-momentum-flare hover:text-momentum-flare/90 transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Manage remembered devices</span>
          </button>

          {showDeviceManagement && <DeviceManagement />}
        </div>

        <div className="space-y-12">
          {user ? (
            <MyClipsSection onUploadClick={onOpenCapture} />
          ) : null}
          <PersonalizedConcerts />
        </div>
      </div>

      {renderRoleDashboard()}
    </div>
  );
}
