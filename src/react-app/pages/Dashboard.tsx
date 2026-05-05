import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2, Settings } from 'lucide-react';
import Header from '@/react-app/components/Header';
import PointsDisplay from '@/react-app/components/PointsDisplay';
import BadgesDisplay from '@/react-app/components/BadgesDisplay';
import DeviceManagement from '@/react-app/components/DeviceManagement';
import PersonalizedFeed from '@/react-app/components/PersonalizedFeed';
import MyClipsSection from '@/react-app/components/MyClipsSection';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import PersonalizationSettings from '@/react-app/components/PersonalizationSettings';
import FanDashboard from '@/react-app/components/dashboards/FanDashboard';
import ArtistDashboard from '@/react-app/components/dashboards/ArtistDashboard';
import AmbassadorDashboard from '@/react-app/components/dashboards/AmbassadorDashboard';
import InfluencerDashboard from '@/react-app/components/dashboards/InfluencerDashboard';
import PremiumDashboard from '@/react-app/components/dashboards/PremiumDashboard';
import type { ExtendedMochaUser } from '@/shared/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [userData, setUserData] = useState<ExtendedMochaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [showPersonalizationSettings, setShowPersonalizationSettings] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        navigate('/');
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
      fetchUserData();
    }
  }, [user, isPending, navigate]);

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userData?.profile) {
    return null;
  }

  const renderDashboard = () => {
    switch (userData.profile?.role) {
      case 'fan':
        return <FanDashboard user={userData} />;
      case 'artist':
      case 'venue':
        return <ArtistDashboard user={userData} />;
      case 'ambassador':
        return <AmbassadorDashboard user={userData} />;
      case 'influencer':
        return <InfluencerDashboard user={userData} />;
      case 'premium':
        return <PremiumDashboard user={userData} />;
      default:
        return <FanDashboard user={userData} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <PointsDisplay />
          <div className="lg:col-span-2">
            <BadgesDisplay compact />
          </div>
        </div>
        
        {/* Settings Sections */}
        <div className="mb-8 space-y-4">
          <button
            onClick={() => setShowPersonalizationSettings(!showPersonalizationSettings)}
            className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Personalization Settings</span>
          </button>
          
          {showPersonalizationSettings && (
            <PersonalizationSettings onClose={() => setShowPersonalizationSettings(false)} />
          )}

          <button
            onClick={() => setShowDeviceManagement(!showDeviceManagement)}
            className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Manage Remembered Devices</span>
          </button>
          
          {showDeviceManagement && <DeviceManagement />}
        </div>

        {/* Personalized Content Sections */}
        <div className="space-y-12 mb-8">
          <PersonalizedFeed />
          {user && <MyClipsSection />}
          <PersonalizedConcerts />
        </div>
      </div>
      {renderDashboard()}
    </div>
  );
}
