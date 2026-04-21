import { Crown, Ticket, Clock, ExternalLink } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import type { ExtendedMochaUser } from '@/shared/types';

interface PremiumPresaleAlertProps {
  artistName: string;
  eventDate: string;
  venueName: string;
  presaleUrl: string;
  presaleEnds: string;
}

export default function PremiumPresaleAlert({
  artistName,
  eventDate,
  venueName,
  presaleUrl,
  presaleEnds,
}: PremiumPresaleAlertProps) {
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const isPremium = extendedUser?.profile?.is_premium === 1;

  if (!isPremium) {
    return null;
  }

  const formatTimeRemaining = () => {
    const now = new Date();
    const end = new Date(presaleEnds);
    const diffMs = end.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minutes`;
    }
    
    if (diffHours < 24) {
      return `${diffHours} hours`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days`;
  };

  return (
    <div className="bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border-2 border-yellow-500/50 rounded-xl p-6 mb-6 animate-glow">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-full flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-3 py-1 bg-yellow-500/30 border border-yellow-500/50 rounded-full text-yellow-400 text-xs font-bold uppercase">
              Premium Presale
            </span>
            <div className="flex items-center space-x-1 text-orange-400 text-sm">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{formatTimeRemaining()} remaining</span>
            </div>
          </div>

          <h3 className="text-white font-bold text-xl mb-2">
            Early Access: {artistName}
          </h3>

          <div className="space-y-1 mb-4">
            <div className="text-gray-300 flex items-center space-x-2">
              <Ticket className="w-4 h-4 text-cyan-400" />
              <span>{venueName}</span>
            </div>
            <div className="text-gray-300 text-sm">
              {new Date(eventDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href={presaleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl font-bold text-white hover:scale-105 transition-transform shadow-lg shadow-yellow-500/30"
            >
              <Ticket className="w-5 h-5" />
              <span>Get Presale Tickets</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            
            <button className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-colors text-sm font-medium">
              Set Reminder
            </button>
          </div>

          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-200 text-sm">
              ⚡ <strong>Premium Perk:</strong> You get 48 hours early access before general public sale opens
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
