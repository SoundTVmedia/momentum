import { useState, useEffect } from 'react';
import { Users, Eye, Heart, Video, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface UserAnalyticsData {
  followers: number;
  following: number;
  profileViews: number;
  savedClips: number;
  clipStats: {
    total_clips: number;
    total_likes: number;
    total_views: number;
    total_comments: number;
    avg_likes: number;
    avg_views: number;
    avg_comments: number;
  };
  engagementOverTime: Array<{
    date: string;
    likes: number;
    views: number;
    comments: number;
  }>;
  topClips: Array<any>;
}

interface UserAnalyticsProps {
  userId?: string;
}

export default function UserAnalytics({ userId }: UserAnalyticsProps) {
  const [data, setData] = useState<UserAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [userId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const url = userId 
        ? `/api/analytics/user?user_id=${userId}`
        : '/api/analytics/user';
      
      const response = await fetch(url);
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
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
        <p className="text-gray-400">Failed to load analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/20 rounded-lg">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {data.followers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Followers</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Eye className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {data.profileViews.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Profile Views (30d)</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Video className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {data.clipStats.total_clips.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Clips</div>
        </div>

        <div className="bg-black/40 backdrop-blur-lg border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Heart className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {data.clipStats.total_likes.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Likes</div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Average Engagement</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Avg. Views per Clip</span>
                <Eye className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {Math.round(data.clipStats.avg_views || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Avg. Likes per Clip</span>
                <Heart className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {Math.round(data.clipStats.avg_likes || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Avg. Comments per Clip</span>
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {Math.round(data.clipStats.avg_comments || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Engagement Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.engagementOverTime}>
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
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Views"
              />
              <Line 
                type="monotone" 
                dataKey="likes" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Likes"
              />
              <Line 
                type="monotone" 
                dataKey="comments" 
                stroke="#a855f7" 
                strokeWidth={2}
                name="Comments"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performing Clips */}
      {data.topClips.length > 0 && (
        <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Top Performing Clips</h3>
          <div className="space-y-4">
            {data.topClips.map((clip, index) => (
              <div key={clip.id} className="flex items-center space-x-4 p-4 bg-white/5 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <span className="text-cyan-400 font-bold text-sm">#{index + 1}</span>
                </div>
                <img
                  src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop'}
                  alt="Clip thumbnail"
                  className="w-16 h-16 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {clip.artist_name || 'Unknown Artist'}
                  </div>
                  <div className="text-gray-400 text-sm truncate">
                    {clip.venue_name || 'Unknown Venue'}
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1 text-blue-400">
                    <Eye className="w-4 h-4" />
                    <span>{clip.views_count}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-red-400">
                    <Heart className="w-4 h-4" />
                    <span>{clip.likes_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
