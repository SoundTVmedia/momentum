import { Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import type { ExtendedMochaUser } from '@/shared/types';

interface PremiumCTAProps {
  variant?: 'banner' | 'card' | 'inline';
  context?: string;
}

export default function PremiumCTA({ 
  variant = 'card'
}: PremiumCTAProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;

  // Don't show if already premium
  if (extendedUser?.profile?.is_premium === 1) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-yellow-500/10 via-amber-600/10 to-orange-500/10 border border-yellow-400/30 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Crown className="w-8 h-8 text-yellow-400 flex-shrink-0 animate-pulse" />
            <div>
              <div className="text-white font-bold mb-1">Unlock Premium Features</div>
              <div className="text-gray-300 text-sm">
                Get early access to tickets, exclusive content & more
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/premium')}
            className="px-6 py-2 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-lg font-bold text-black hover:scale-105 transition-transform whitespace-nowrap flex items-center space-x-2"
          >
            <span>Upgrade</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={() => navigate('/premium')}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/20 to-amber-600/20 hover:from-yellow-500/30 hover:to-amber-600/30 border border-yellow-400/40 rounded-lg transition-all group"
      >
        <div className="flex items-center space-x-3">
          <Crown className="w-5 h-5 text-yellow-400" />
          <div className="text-left">
            <div className="text-white font-medium text-sm">Go Premium</div>
            <div className="text-gray-400 text-xs">Unlock all features</div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-yellow-400 group-hover:translate-x-1 transition-transform" />
      </button>
    );
  }

  // Default: card variant
  return (
    <div className="bg-gradient-to-br from-yellow-500/20 via-amber-600/20 to-orange-500/20 border-2 border-yellow-400/40 rounded-xl p-6 relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-600 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center space-x-2 mb-4">
          <Crown className="w-8 h-8 text-yellow-400 animate-bounce-slow" />
          <h3 className="text-xl font-bold text-white">Upgrade to Premium</h3>
        </div>

        <p className="text-gray-300 mb-6">
          Get VIP access to exclusive content, early tickets, and premium experiences
        </p>

        <button
          onClick={() => navigate('/premium')}
          className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 rounded-xl font-bold text-black hover:scale-105 transition-transform shadow-lg shadow-yellow-500/30"
        >
          Start Free Trial
        </button>

        <p className="text-center text-xs text-gray-400 mt-3">
          Just $9.99/month • Cancel anytime
        </p>
      </div>
    </div>
  );
}
