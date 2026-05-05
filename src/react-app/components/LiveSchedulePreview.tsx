import { Clock, Music, MapPin, Sparkles, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import type { ExtendedMochaUser } from '@/shared/types';
import { artistPath } from '@/shared/app-paths';

interface ScheduleItem {
  id: number;
  clip_id: number;
  order_index: number;
  scheduled_start_time: string | null;
  artist_name: string | null;
  venue_name: string | null;
  thumbnail_url: string | null;
  content_description: string | null;
  user_display_name: string | null;
}

interface LiveSchedulePreviewProps {
  items: ScheduleItem[];
  showShareOptions?: boolean;
}

export default function LiveSchedulePreview({ items, showShareOptions = false }: LiveSchedulePreviewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const [showCopied, setShowCopied] = useState(false);

  const isAmbassador = extendedUser?.profile?.role === 'ambassador';

  const handleShare = async () => {
    const link = `${window.location.origin}/?live=true${isAmbassador && user ? `&ref=${user.id}` : ''}`;
    
    try {
      await navigator.clipboard.writeText(link);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border border-purple-500/30 rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
          <h3 className="font-bold text-white text-lg">Coming Up Next</h3>
        </div>
        {showShareOptions && (
          <button
            onClick={handleShare}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm text-white"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share Tonight's Show</span>
            <span className="sm:hidden">Share</span>
          </button>
        )}
      </div>

      {showCopied && (
        <div className="mb-3 p-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
          ✓ Link copied! Share with friends to earn points
        </div>
      )}

      <div className="space-y-3">
        {items.slice(0, 5).map((item, index) => (
          <div
            key={item.id}
            className="group flex items-center space-x-3 p-3 bg-black/30 hover:bg-black/40 rounded-lg transition-all cursor-pointer"
            onClick={() => item.artist_name && navigate(artistPath(item.artist_name))}
          >
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center font-bold text-white">
              {index + 1}
            </div>

            <div className="flex-shrink-0">
              <img
                src={item.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop'}
                alt="Preview"
                className="w-14 h-14 rounded object-cover group-hover:scale-110 transition-transform"
              />
            </div>

            <div className="flex-1 min-w-0">
              {item.artist_name && (
                <div className="flex items-center space-x-2 mb-1">
                  <Music className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div className="text-white font-medium truncate">{item.artist_name}</div>
                </div>
              )}
              {item.venue_name && (
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <div className="text-gray-400 text-sm truncate">{item.venue_name}</div>
                </div>
              )}
              {item.scheduled_start_time && (
                <div className="flex items-center space-x-2 mt-1">
                  <Clock className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <div className="text-cyan-400 text-xs">
                    {new Date(item.scheduled_start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {items.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-purple-400 hover:text-purple-300 text-sm font-medium">
            +{items.length - 5} more clips in tonight's show
          </button>
        </div>
      )}
    </div>
  );
}
