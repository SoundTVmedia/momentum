import { useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import UserAnalytics from '@/react-app/components/UserAnalytics';
import { BarChart3, ArrowLeft } from 'lucide-react';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/');
    } else if (!isPending) {
      setLoading(false);
    }
  }, [user, isPending, navigate]);

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-10 h-10 text-cyan-400" />
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Your Analytics</h1>
              <p className="text-gray-300 text-lg">Track your performance and engagement</p>
            </div>
          </div>
        </div>

        {/* Analytics Content */}
        <UserAnalytics />
      </div>
    </div>
  );
}
