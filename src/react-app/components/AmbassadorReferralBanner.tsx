import { Share2, DollarSign, TrendingUp, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import type { ExtendedMochaUser } from '@/shared/types';

export default function AmbassadorReferralBanner() {
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const [copied, setCopied] = useState(false);

  const isAmbassador = extendedUser?.profile?.role === 'ambassador';

  if (!isAmbassador || !user) {
    return null;
  }

  const referralLink = `${window.location.origin}/?ref=${user.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-gradient-to-r from-orange-500/20 to-red-600/20 border border-orange-500/40 rounded-xl p-4 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg mb-1">Ambassador Referral Program</h3>
            <p className="text-gray-300 text-sm mb-2">
              Earn 15% commission on every ticket sale through your link
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3 h-3" />
                <span>Track in Dashboard</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center space-x-2">
          <div className="flex-1 sm:w-64 px-3 py-2 bg-black/40 border border-white/20 rounded-lg">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="w-full bg-transparent text-white text-sm outline-none"
            />
          </div>
          <button
            onClick={handleCopy}
            className="p-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-colors flex-shrink-0"
            title="Copy link"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Copy className="w-5 h-5 text-orange-400" />
            )}
          </button>
          <button
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: 'Check out MOMENTUM',
                    text: 'Join me on MOMENTUM - the live music community',
                    url: referralLink
                  });
                } else {
                  handleCopy();
                }
              } catch (err) {
                console.error('Share failed:', err);
              }
            }}
            className="p-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-colors flex-shrink-0"
            title="Share link"
          >
            <Share2 className="w-5 h-5 text-orange-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
