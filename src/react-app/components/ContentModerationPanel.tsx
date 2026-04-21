import { useState, useEffect } from 'react';
import { Shield, Flag, Trash2, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2, Search } from 'lucide-react';

interface FlaggedClip {
  id: number;
  clip_id: number;
  reported_by: string;
  reason: string;
  status: string;
  created_at: string;
  artist_name: string | null;
  venue_name: string | null;
  thumbnail_url: string | null;
  video_url: string;
  reporter_display_name: string | null;
  clip_user_id: string;
  clip_user_display_name: string | null;
}

interface FlaggedUser {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  flag_count: number;
  latest_flag_reason: string | null;
  is_banned: number;
}

export default function ContentModerationPanel() {
  const [activeTab, setActiveTab] = useState<'clips' | 'users'>('clips');
  const [flaggedClips, setFlaggedClips] = useState<FlaggedClip[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  useEffect(() => {
    if (activeTab === 'clips') {
      fetchFlaggedClips();
    } else {
      fetchFlaggedUsers();
    }
  }, [activeTab, statusFilter]);

  const fetchFlaggedClips = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/moderation/clips?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setFlaggedClips(data.flaggedClips || []);
      }
    } catch (error) {
      console.error('Failed to fetch flagged clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlaggedUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/moderation/users');
      if (response.ok) {
        const data = await response.json();
        setFlaggedUsers(data.flaggedUsers || []);
      }
    } catch (error) {
      console.error('Failed to fetch flagged users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClip = async (flagId: number, action: 'approve' | 'remove') => {
    try {
      const response = await fetch(`/api/admin/moderation/clips/${flagId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchFlaggedClips();
      }
    } catch (error) {
      console.error('Failed to review clip:', error);
    }
  };

  const handleDeleteClip = async (clipId: number) => {
    if (!confirm('Are you sure you want to permanently delete this clip?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clips/${clipId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFlaggedClips();
      }
    } catch (error) {
      console.error('Failed to delete clip:', error);
    }
  };

  const handleBanUser = async (userId: string, duration?: number) => {
    const durationText = duration ? `${duration} days` : 'permanently';
    if (!confirm(`Are you sure you want to ban this user ${durationText}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_days: duration || null }),
      });

      if (response.ok) {
        fetchFlaggedUsers();
      }
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchFlaggedUsers();
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getReasonColor = (reason: string) => {
    const lower = reason.toLowerCase();
    if (lower.includes('spam')) return 'text-yellow-400';
    if (lower.includes('inappropriate') || lower.includes('nsfw')) return 'text-red-400';
    if (lower.includes('copyright')) return 'text-orange-400';
    return 'text-gray-400';
  };

  const filteredClips = flaggedClips.filter(clip => 
    !searchQuery || 
    clip.artist_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clip.venue_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clip.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = flaggedUsers.filter(user =>
    !searchQuery ||
    user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Content Moderation</h2>

        {/* Tab Navigation */}
        <div className="flex space-x-4 border-b border-white/10 mb-6">
          <button
            onClick={() => setActiveTab('clips')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'clips'
                ? 'text-red-400 border-b-2 border-red-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Flag className="w-5 h-5" />
              <span>Flagged Clips</span>
              {flaggedClips.filter(c => c.status === 'pending').length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs text-white">
                  {flaggedClips.filter(c => c.status === 'pending').length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'users'
                ? 'text-red-400 border-b-2 border-red-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Flagged Users</span>
            </div>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'clips' ? 'Search clips...' : 'Search users...'}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
            />
          </div>
          {activeTab === 'clips' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="removed">Removed</option>
              <option value="all">All</option>
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        </div>
      ) : activeTab === 'clips' ? (
        <div className="space-y-4">
          {filteredClips.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No flagged clips found</p>
            </div>
          ) : (
            filteredClips.map((flag) => (
              <div
                key={flag.id}
                className="bg-black/40 backdrop-blur-lg border border-red-500/20 rounded-xl p-6"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Clip Preview */}
                  <div className="lg:w-64 flex-shrink-0">
                    <img
                      src={flag.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop'}
                      alt="Clip thumbnail"
                      className="w-full h-40 rounded-lg object-cover"
                    />
                    <div className="mt-2 text-sm">
                      {flag.artist_name && (
                        <div className="text-purple-400 font-medium">{flag.artist_name}</div>
                      )}
                      {flag.venue_name && (
                        <div className="text-gray-400">{flag.venue_name}</div>
                      )}
                    </div>
                  </div>

                  {/* Flag Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <Flag className={`w-5 h-5 ${getReasonColor(flag.reason)}`} />
                          <span className={`font-semibold ${getReasonColor(flag.reason)}`}>
                            {flag.reason}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          Reported by {flag.reporter_display_name || 'Anonymous'} on {formatTimestamp(flag.created_at)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Uploaded by {flag.clip_user_display_name || 'Anonymous'}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        flag.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        flag.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {flag.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Actions */}
                    {flag.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleReviewClip(flag.id, 'approve')}
                          className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors flex items-center space-x-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Approve (Keep Clip)</span>
                        </button>
                        <button
                          onClick={() => handleReviewClip(flag.id, 'remove')}
                          className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors flex items-center space-x-2"
                        >
                          <EyeOff className="w-4 h-4" />
                          <span>Hide Clip</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClip(flag.clip_id)}
                          className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors flex items-center space-x-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Permanently</span>
                        </button>
                        <a
                          href={flag.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Review Video</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No flagged users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.mocha_user_id}
                className="bg-black/40 backdrop-blur-lg border border-red-500/20 rounded-xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={user.profile_image_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=60&h=60&fit=crop&crop=face'}
                      alt={user.display_name || 'User'}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-white font-semibold mb-1">
                        {user.display_name || 'Anonymous'}
                      </div>
                      <div className="flex items-center space-x-3 text-sm">
                        <span className="text-red-400">
                          {user.flag_count} {user.flag_count === 1 ? 'report' : 'reports'}
                        </span>
                        {user.latest_flag_reason && (
                          <span className="text-gray-400">
                            Latest: {user.latest_flag_reason}
                          </span>
                        )}
                      </div>
                      {user.is_banned === 1 && (
                        <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                          BANNED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {user.is_banned === 1 ? (
                      <button
                        onClick={() => handleUnbanUser(user.mocha_user_id)}
                        className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        Unban User
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleBanUser(user.mocha_user_id, 7)}
                          className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-colors"
                        >
                          Ban 7 Days
                        </button>
                        <button
                          onClick={() => handleBanUser(user.mocha_user_id)}
                          className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          Ban Permanently
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
