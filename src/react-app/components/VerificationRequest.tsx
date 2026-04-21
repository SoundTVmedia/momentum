import { useState } from 'react';
import { X, CheckCircle, Upload, Loader2, AlertCircle, Shield } from 'lucide-react';

interface VerificationRequestProps {
  onClose: () => void;
  userRole: string;
}

export default function VerificationRequest({ onClose, userRole }: VerificationRequestProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    reason: '',
    proof_url: '',
    social_links: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/verification-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit verification request');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const getRoleSpecificGuidance = () => {
    switch (userRole) {
      case 'artist':
        return {
          title: 'Artist Verification',
          description: 'Get verified to show fans you\'re the real deal',
          requirements: [
            'Link to your official music profiles (Spotify, Apple Music, etc.)',
            'Social media accounts with significant following',
            'Proof of identity (official website, press mentions, etc.)',
          ],
        };
      case 'venue':
        return {
          title: 'Venue Verification',
          description: 'Verify your venue to build trust with artists and fans',
          requirements: [
            'Official venue website or business listing',
            'Social media presence',
            'Business registration or licensing documents',
          ],
        };
      case 'influencer':
        return {
          title: 'Influencer Verification',
          description: 'Get verified to unlock partnership opportunities',
          requirements: [
            'Social media profiles with 10,000+ followers',
            'Consistent content creation in music/entertainment',
            'Engagement metrics demonstrating influence',
          ],
        };
      default:
        return {
          title: 'Account Verification',
          description: 'Verify your account to build credibility',
          requirements: [
            'Valid proof of identity',
            'Active social media presence',
            'Legitimate purpose for verification',
          ],
        };
    }
  };

  const guidance = getRoleSpecificGuidance();

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gradient-to-b from-slate-900 to-black border border-cyan-500/20 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">{guidance.title}</h2>
                <p className="text-gray-300 text-sm">{guidance.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        {success ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Request Submitted!</h3>
            <p className="text-gray-300">
              We'll review your verification request and get back to you within 3-5 business days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Requirements */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="text-white font-bold mb-2">Requirements:</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                {guidance.requirements.map((req, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-white font-medium mb-2">
                Full Name / {userRole === 'venue' ? 'Venue' : 'Artist'} Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="Enter your official name"
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-white font-medium mb-2">
                Why should you be verified?
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 resize-none"
                placeholder="Explain your eligibility and why verification is important to you..."
                required
                maxLength={1000}
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {formData.reason.length}/1000
              </div>
            </div>

            {/* Proof URL */}
            <div>
              <label className="block text-white font-medium mb-2">
                Proof Link (Website, Press, Official Profile)
              </label>
              <input
                type="url"
                value={formData.proof_url}
                onChange={(e) => setFormData(prev => ({ ...prev, proof_url: e.target.value }))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="https://"
                required
              />
            </div>

            {/* Social Links */}
            <div>
              <label className="block text-white font-medium mb-2">
                Social Media Links (comma-separated)
              </label>
              <textarea
                value={formData.social_links}
                onChange={(e) => setFormData(prev => ({ ...prev, social_links: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 resize-none"
                placeholder="https://instagram.com/yourprofile, https://twitter.com/yourprofile"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Include links to your official social media profiles
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
