import { Calendar, Music, Play, Star } from 'lucide-react';
import { useNavigate } from 'react-router';
import { showClipsPath } from '@/shared/app-paths';

export interface PastShowSummary {
  show_id: string;
  artist_name: string;
  show_date: string;
  venue_name?: string | null;
  clip_count: number;
  average_show_rating?: number;
  thumbnail_url: string | null;
}

interface PastShowsGridProps {
  shows: PastShowSummary[];
  /** artist page cards emphasize venue; venue page cards emphasize artist */
  variant: 'artist' | 'venue';
  venueLabel?: string;
}

function formatShowDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PastShowsGrid({ shows, variant, venueLabel }: PastShowsGridProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {shows.map((show) => {
        const title =
          variant === 'artist'
            ? show.venue_name?.trim() || 'Venue TBA'
            : show.artist_name;
        const subtitle =
          variant === 'artist'
            ? formatShowDate(show.show_date)
            : formatShowDate(show.show_date);

        return (
          <button
            key={`${show.show_id}-${show.artist_name}-${show.show_date}`}
            type="button"
            onClick={() => navigate(showClipsPath(show.artist_name, show.show_id))}
            className="glass-panel border border-momentum-rose/20 rounded-xl overflow-hidden hover:border-momentum-rose/50 transition-all group text-left"
          >
            <div className="relative aspect-video">
              <img
                src={
                  show.thumbnail_url ||
                  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
                }
                alt={
                  variant === 'artist'
                    ? `${title} — ${formatShowDate(show.show_date)}`
                    : `${show.artist_name} at ${venueLabel ?? 'venue'}`
                }
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity [@media(hover:hover)_and_(pointer:fine)]:hidden">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 flex items-center space-x-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                <Music className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-medium">
                  {show.clip_count} clip{show.clip_count !== 1 ? 's' : ''}
                </span>
              </div>
              {(show.average_show_rating ?? 0) > 0 && (
                <div className="absolute bottom-2 right-2 flex items-center space-x-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Star className="w-3 h-3 text-momentum-ember fill-current" />
                  <span className="text-white text-xs font-medium">
                    {show.average_show_rating!.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{title}</h4>
              <div className="flex items-center space-x-1.5 text-gray-400 text-xs">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="line-clamp-1">{subtitle}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
