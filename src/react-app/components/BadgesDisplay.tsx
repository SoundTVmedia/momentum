import { useEffect, useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Award, X } from 'lucide-react';

interface Badge {
  id: number;
  name: string;
  description: string;
  icon_url: string | null;
  earned_at: string;
}

interface BadgesDisplayProps {
  compact?: boolean;
}

export default function BadgesDisplay({ compact = false }: BadgesDisplayProps) {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchBadges = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/gamification/badges');
        if (response.ok) {
          const data = await response.json();
          setBadges(data.badges || []);
        }
      } catch (err) {
        console.error('Failed to fetch badges:', err);
      }
    };

    fetchBadges();
  }, [user]);

  if (!user || badges.length === 0) return null;

  const displayBadges = compact ? badges.slice(0, 3) : badges;

  return (
    <div>
      {compact ? (
        <div className="flex items-center space-x-2">
          {displayBadges.map((badge) => (
            <div
              key={badge.id}
              className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
              title={badge.name}
            >
              <Award className="w-5 h-5 text-white" />
            </div>
          ))}
          {badges.length > 3 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              +{badges.length - 3} more
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div className="text-white font-bold text-sm mb-1">{badge.name}</div>
              <div className="text-gray-400 text-xs">{badge.description}</div>
              <div className="text-xs text-gray-500 mt-2">
                Earned {new Date(badge.earned_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAll && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-black/95 border border-purple-500/20 rounded-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Your Badges</h3>
              <button
                onClick={() => setShowAll(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 text-center"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-white font-bold text-sm mb-1">{badge.name}</div>
                  <div className="text-gray-400 text-xs">{badge.description}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(badge.earned_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
