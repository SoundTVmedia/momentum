import { useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Trophy, Star, TrendingUp } from 'lucide-react';

interface UserPoints {
  points: number;
  level: number;
}

export default function PointsDisplay() {
  const { user } = useAuth();
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);

  useEffect(() => {
    const fetchPoints = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/gamification/points');
        if (response.ok) {
          const data = await response.json();
          setUserPoints(data);
        }
      } catch (err) {
        console.error('Failed to fetch points:', err);
      }
    };

    fetchPoints();
  }, [user]);

  if (!user || !userPoints) return null;

  const pointsToNextLevel = (userPoints.level * 100) - userPoints.points;
  const progressPercentage = (userPoints.points % 100);

  return (
    <div className="bg-gradient-to-r from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-bold">Level {userPoints.level}</span>
        </div>
        <div className="flex items-center space-x-1 text-purple-300">
          <Star className="w-4 h-4" />
          <span className="font-bold">{userPoints.points}</span>
          <span className="text-xs">points</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Progress to Level {userPoints.level + 1}</span>
          <span>{pointsToNextLevel} points left</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="flex items-center space-x-1 text-xs text-gray-400">
        <TrendingUp className="w-3 h-3" />
        <span>Keep engaging to level up!</span>
      </div>
    </div>
  );
}
