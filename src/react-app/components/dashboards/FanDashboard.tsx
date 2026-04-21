import { Play, Upload, Heart, Ticket, Users, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ExtendedMochaUser } from '@/shared/types';

interface FanDashboardProps {
  user: ExtendedMochaUser;
}

export default function FanDashboard({ user }: FanDashboardProps) {
  const navigate = useNavigate();
  const displayName = user.profile?.display_name || user.google_user_data.name || 'Fan';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Hey {displayName}! 🎵
          </h1>
          <p className="text-gray-300 text-lg">Ready to catch up on the scene?</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => navigate('/upload')}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl p-6 hover:scale-105 transition-transform"
          >
            <Upload className="w-8 h-8 text-white mb-2" />
            <div className="text-white font-bold">Drop a Clip</div>
            <div className="text-white/80 text-sm">Share the vibes</div>
          </button>

          <button 
            onClick={() => navigate('/')}
            className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-400/50 transition-all"
          >
            <Play className="w-8 h-8 text-cyan-400 mb-2" />
            <div className="text-white font-bold">Jump In Live</div>
            <div className="text-gray-300 text-sm">Catch tonight's show</div>
          </button>

          <button 
            onClick={() => navigate('/')}
            className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-400/50 transition-all"
          >
            <Ticket className="w-8 h-8 text-cyan-400 mb-2" />
            <div className="text-white font-bold">Find Shows</div>
            <div className="text-gray-300 text-sm">See who's playing</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-400/50 transition-all">
            <Users className="w-8 h-8 text-cyan-400 mb-2" />
            <div className="text-white font-bold">Follow Artists</div>
            <div className="text-gray-300 text-sm">Never miss a drop</div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Clips Uploaded</span>
              <Upload className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-white">0</div>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Total Likes</span>
              <Heart className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-white">0</div>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Following</span>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white">0</div>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Featured</span>
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">0</div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Your Clips */}
          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Your Clips</h2>
            <div className="text-center py-12">
              <Upload className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No clips yet. Time to share!</p>
              <button 
                onClick={() => navigate('/upload')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
              >
                Share Your First Moment
              </button>
            </div>
          </div>

          {/* Feed */}
          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Concert Feed</h2>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"></div>
                  <div>
                    <div className="text-white font-medium">musicfan_nyc</div>
                    <div className="text-gray-400 text-sm">2 min ago</div>
                  </div>
                </div>
                <p className="text-gray-300 text-sm">Arctic Monkeys absolutely killed it tonight! 🔥</p>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                  <div>
                    <div className="text-white font-medium">concert_queen</div>
                    <div className="text-gray-400 text-sm">5 min ago</div>
                  </div>
                </div>
                <p className="text-gray-300 text-sm">The energy at The Forum was incredible!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
