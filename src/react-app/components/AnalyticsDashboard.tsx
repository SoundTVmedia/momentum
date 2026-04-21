import { useState, useEffect } from 'react';
import { TrendingUp, Users, Video, Heart, Eye, BarChart3, Activity, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PlatformStats {
  totalUsers: number;
  totalClips: number;
  totalViews: number;
  totalLikes: number;
  activeSessions: number;
  totalSessions: number;
}

interface GrowthData {
  date: string;
  users: number;
  clips: number;
  views: number;
}

interface TopClip {
  id: number;
  artist_name: string | null;
  venue_name: string | null;
  thumbnail_url: string | null;
  likes_count: number;
  views_count: number;
  comments_count: number;
  user_display_name: string | null;
}

interface TopUser {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  total_clips: number;
  total_likes: number;
  total_views: number;
}

interface AnalyticsData {
  platformStats: PlatformStats;
  growthData: GrowthData[];
  topClips: TopClip[];
  topUsers: TopUser[];
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/platform?range=${timeRange}`);
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Failed to load analytics data</p>
      </div>
    );
  }

  const { platformStats, growthData, topClips, topUsers } = data;

  return (
    <div className="space-y-8">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Platform Analytics</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === '7d'
                ? 'bg-cyan-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === '30d'
                ? 'bg-cyan-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === '90d'
                ? 'bg-cyan-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/20 rounded-lg">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {platformStats.totalUsers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Users</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Video className="w-6 h-6 text-purple-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {platformStats.totalClips.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Clips</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {platformStats.totalViews.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Views</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Heart className="w-6 h-6 text-red-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {platformStats.totalLikes.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Likes</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-xs text-green-400 font-medium">LIVE</div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {platformStats.activeSessions}
          </div>
          <div className="text-sm text-gray-400">Active Sessions</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {platformStats.totalSessions.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Sessions</div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-6">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Growth Trends</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={growthData}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorClips" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="users" 
              stroke="#06b6d4" 
              fillOpacity={1} 
              fill="url(#colorUsers)"
              name="New Users"
            />
            <Area 
              type="monotone" 
              dataKey="clips" 
              stroke="#a855f7" 
              fillOpacity={1} 
              fill="url(#colorClips)"
              name="New Clips"
            />
            <Area 
              type="monotone" 
              dataKey="views" 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorViews)"
              name="Views"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Clips */}
        <div className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Top Performing Clips</h3>
          <div className="space-y-4">
            {topClips.slice(0, 5).map((clip, index) => (
              <div key={clip.id} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <span className="text-purple-400 font-bold text-sm">#{index + 1}</span>
                </div>
                <img
                  src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop'}
                  alt="Clip thumbnail"
                  className="w-12 h-12 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {clip.artist_name || 'Unknown Artist'}
                  </div>
                  <div className="text-gray-400 text-xs truncate">
                    {clip.venue_name || 'Unknown Venue'}
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-1 text-red-400">
                    <Heart className="w-4 h-4" />
                    <span>{clip.likes_count}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-blue-400">
                    <Eye className="w-4 h-4" />
                    <span>{clip.views_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Top Contributors</h3>
          <div className="space-y-4">
            {topUsers.slice(0, 5).map((user, index) => (
              <div key={user.mocha_user_id} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <span className="text-cyan-400 font-bold text-sm">#{index + 1}</span>
                </div>
                <img
                  src={user.profile_image_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                  alt={user.display_name || 'User'}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {user.display_name || 'Anonymous'}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {user.total_clips} clips
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-1 text-red-400">
                    <Heart className="w-4 h-4" />
                    <span>{user.total_likes}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-blue-400">
                    <Eye className="w-4 h-4" />
                    <span>{user.total_views}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
