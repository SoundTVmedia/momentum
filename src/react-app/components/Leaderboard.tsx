import { useEffect, useState } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { useNavigate } from 'react-router';

interface LeaderboardEntry {
  mocha_user_id: string;
  points: number;
  level: number;
  display_name: string | null;
  profile_image_url: string | null;
  badge_count: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<'all_time' | 'weekly' | 'monthly'>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/gamification/leaderboard?timeframe=${timeframe}&limit=50`);
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard || []);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [timeframe]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-400" />;
      default:
        return <span className="text-gray-500 font-bold">#{rank}</span>;
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <span>Leaderboard</span>
        </h2>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setTimeframe('weekly')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              timeframe === 'weekly'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setTimeframe('monthly')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              timeframe === 'monthly'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setTimeframe('all_time')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
              timeframe === 'all_time'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No data yet</div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.mocha_user_id}
              onClick={() => navigate(`/users/${entry.mocha_user_id}`)}
              className={`flex items-center space-x-4 p-4 rounded-xl cursor-pointer transition-all ${
                index < 3
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 hover:border-purple-400/50'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex-shrink-0 w-8 flex items-center justify-center">
                {getRankIcon(index + 1)}
              </div>

              <img
                src={entry.profile_image_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                alt={entry.display_name || 'User'}
                className="w-10 h-10 rounded-full object-cover"
              />

              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">
                  {entry.display_name || 'Anonymous User'}
                </div>
                <div className="flex items-center space-x-3 text-xs text-gray-400">
                  <span>Level {entry.level}</span>
                  {entry.badge_count > 0 && (
                    <span className="flex items-center space-x-1">
                      <Award className="w-3 h-3" />
                      <span>{entry.badge_count} badges</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-purple-400">
                  {entry.points.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">points</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
