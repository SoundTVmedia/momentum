import { MapPin, Users, TrendingUp, DollarSign, Award, Calendar, Video, Zap, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import AmbassadorReferralBanner from '@/react-app/components/AmbassadorReferralBanner';
import TicketmasterEventGrid from '@/react-app/components/TicketmasterEventGrid';
import JamBaseEventGrid from '@/react-app/components/JamBaseEventGrid';
import type { ExtendedMochaUser } from '@/shared/types';

interface AmbassadorDashboardProps {
  user: ExtendedMochaUser;
}

interface AmbassadorAnalytics {
  totalEarnings: number;
  monthlyEarnings: number;
  earningsBalance: number;
  conversionStats: {
    total_conversions: number;
    conversion_rate: number;
  };
  recentSales: Array<any>;
}

export default function AmbassadorDashboard({ user }: AmbassadorDashboardProps) {
  const navigate = useNavigate();
  const displayName = user.profile?.display_name || user.google_user_data.name || 'Ambassador';
  const city = user.profile?.city || 'Your City';
  const [analytics, setAnalytics] = useState<AmbassadorAnalytics | null>(null);
  const [promoEventCatalog, setPromoEventCatalog] = useState<'jambase' | 'ticketmaster'>('jambase');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/ambassador');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch ambassador analytics:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Award className="w-10 h-10 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">
              Ambassador Hub - {displayName}
            </h1>
          </div>
          <p className="text-gray-300 text-lg">Leading the music scene in {city}</p>
        </div>

        {/* Ambassador Referral Banner */}
        <AmbassadorReferralBanner />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => navigate('/upload')}
            className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 hover:scale-105 transition-transform"
          >
            <Video className="w-8 h-8 text-white mb-2" />
            <div className="text-white font-bold">Upload Clip</div>
            <div className="text-white/80 text-sm">Share local shows</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6 hover:border-orange-400/50 transition-all">
            <Calendar className="w-8 h-8 text-orange-400 mb-2" />
            <div className="text-white font-bold">Events</div>
            <div className="text-gray-300 text-sm">Promote shows</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6 hover:border-orange-400/50 transition-all">
            <Users className="w-8 h-8 text-orange-400 mb-2" />
            <div className="text-white font-bold">Community</div>
            <div className="text-gray-300 text-sm">Build network</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6 hover:border-orange-400/50 transition-all">
            <DollarSign className="w-8 h-8 text-orange-400 mb-2" />
            <div className="text-white font-bold">Earnings</div>
            <div className="text-gray-300 text-sm">Track commission</div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Local Followers</span>
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-white">1.2K</div>
            <div className="text-sm text-green-400">+156 this month</div>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Events Promoted</span>
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-white">28</div>
            <div className="text-sm text-green-400">+8 this month</div>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Total Reach</span>
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">45K</div>
            <div className="text-sm text-green-400">+12K this month</div>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Commission Earned</span>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              ${analytics?.totalEarnings.toFixed(2) || '0.00'}
            </div>
            <div className="text-sm text-green-400">
              +${analytics?.monthlyEarnings.toFixed(2) || '0.00'} this month
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="grid grid-cols-1 gap-8">
          {/* Live Events to Promote */}
          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-white">Events to Promote in {city}</h2>
              <div className="text-sm text-gray-400">Earn 15% commission per sale</div>
            </div>
            <div className="flex gap-2 mb-6 flex-wrap">
              <button
                type="button"
                onClick={() => setPromoEventCatalog('jambase')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  promoEventCatalog === 'jambase'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                    : 'bg-white/5 text-gray-300 border border-orange-500/20'
                }`}
              >
                JamBase
              </button>
              <button
                type="button"
                onClick={() => setPromoEventCatalog('ticketmaster')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  promoEventCatalog === 'ticketmaster'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-white/5 text-gray-300 border border-orange-500/20'
                }`}
              >
                Ticketmaster
              </button>
            </div>
            {promoEventCatalog === 'jambase' ? (
              <JamBaseEventGrid city={city === 'Your City' ? undefined : city} maxEvents={8} />
            ) : (
              <TicketmasterEventGrid city={city === 'Your City' ? undefined : city} maxEvents={8} />
            )}
          </div>

          {/* Local Events */}
          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Local Events in {city}</h2>
              <button className="text-orange-400 hover:text-orange-300 text-sm font-medium">
                Add Event
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold mb-1">Local Band Night</div>
                    <div className="text-gray-400 text-sm">The Underground - Friday 8PM</div>
                  </div>
                  <Calendar className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">124 interested</span>
                  <button className="px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 rounded text-white text-xs hover:scale-105 transition-transform">
                    Promote
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold mb-1">Jazz & Blues Festival</div>
                    <div className="text-gray-400 text-sm">City Park - Saturday 2PM</div>
                  </div>
                  <Calendar className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">542 interested</span>
                  <button className="px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 rounded text-white text-xs hover:scale-105 transition-transform">
                    Promote
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold mb-1">Indie Showcase</div>
                    <div className="text-gray-400 text-sm">The Loft - Next Thursday</div>
                  </div>
                  <Calendar className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">89 interested</span>
                  <button className="px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 rounded text-white text-xs hover:scale-105 transition-transform">
                    Promote
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Commission Opportunities */}
          <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Commission Opportunities</h2>
              <Zap className="w-6 h-6 text-orange-400" />
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-orange-500/10 to-red-600/10 rounded-lg border border-orange-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Ticket Sales</div>
                    <div className="text-gray-400 text-sm">Earn on every ticket sold</div>
                  </div>
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-400 font-bold">15% commission</span>
                  <button className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20 transition-colors">
                    View Details
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Venue Partnerships</div>
                    <div className="text-gray-400 text-sm">Partner with local venues</div>
                  </div>
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-400 font-bold">10% commission</span>
                  <button className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20 transition-colors">
                    View Details
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Artist Collaborations</div>
                    <div className="text-gray-400 text-sm">Connect artists with brands</div>
                  </div>
                  <Award className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-400 font-bold">20% commission</span>
                  <button className="px-3 py-1 bg-white/10 text-white text-xs rounded hover:bg-white/20 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-8 bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">This Month's Performance</h2>
            <button
              onClick={() => navigate('/analytics')}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              <span>View Details</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">
                {analytics?.conversionStats.total_conversions || 0}
              </div>
              <div className="text-gray-300">Total Conversions</div>
              <div className="text-sm text-green-400 mt-1">
                {analytics?.conversionStats.conversion_rate?.toFixed(1) || '0'}% conversion rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-cyan-400 mb-2">
                ${analytics?.earningsBalance.toFixed(2) || '0.00'}
              </div>
              <div className="text-gray-300">Available Balance</div>
              <div className="text-sm text-gray-400 mt-1">Ready for payout</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">
                ${analytics?.totalEarnings.toFixed(2) || '0.00'}
              </div>
              <div className="text-gray-300">Total Earnings</div>
              <div className="text-sm text-green-400 mt-1">
                +${analytics?.monthlyEarnings.toFixed(2) || '0.00'} this month
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
