import { useState } from 'react';
import { Copy, Check, Share2, ExternalLink } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';

interface ReferralLinkGeneratorProps {
  eventName?: string;
  eventDate?: string;
  ticketUrl?: string;
}

export default function ReferralLinkGenerator({ 
  eventName, 
  eventDate, 
  ticketUrl 
}: ReferralLinkGeneratorProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const generateReferralLink = () => {
    if (!user || !ticketUrl) return '';
    
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      ref: user.id,
      event: eventName || '',
      date: eventDate || '',
      url: ticketUrl,
    });
    
    return `${baseUrl}/tickets?${params.toString()}`;
  };

  const referralLink = generateReferralLink();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Tickets for ${eventName}`,
          text: `Check out ${eventName}! Get your tickets here:`,
          url: referralLink,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      handleCopy();
    }
  };

  if (!ticketUrl) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-red-600/10 border border-orange-500/30 rounded-xl p-4 sm:p-6">
      <div className="flex items-center space-x-2 mb-3">
        <Share2 className="w-5 h-5 text-orange-400" />
        <h3 className="font-bold text-white text-lg">Your Commission Link</h3>
      </div>
      
      <p className="text-gray-300 text-sm mb-4">
        Share this link to earn 15% commission on every ticket sold
      </p>

      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-black/40 border border-white/20 rounded-lg px-3 py-2 overflow-hidden">
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
          onClick={handleShare}
          className="p-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-colors flex-shrink-0"
          title="Share link"
        >
          <Share2 className="w-5 h-5 text-orange-400" />
        </button>

        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-colors flex-shrink-0"
          title="Open ticket page"
        >
          <ExternalLink className="w-5 h-5 text-orange-400" />
        </a>
      </div>

      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="text-green-400 font-bold text-2xl">15%</div>
          <div className="text-sm text-gray-300">
            commission on every sale through your link
          </div>
        </div>
      </div>
    </div>
  );
}
