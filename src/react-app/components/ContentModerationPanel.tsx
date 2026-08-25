import { useState, useEffect } from 'react';
import { Shield, Flag, Trash2, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2, MessageCircle, Search, UserX } from 'lucide-react';
import UserAvatar from '@/react-app/components/UserAvatar';
import ClipPosterImage from '@/react-app/components/ClipPosterImage';
import { reportReasonLabel } from '@/shared/report-reasons';

const PLAYBACK_SYSTEM_REPORTER = 'system:playback';

function moderationReasonLabel(code: string): string {
  if (code === 'unplayable_video') return 'Unplayable video';
  return reportReasonLabel(code);
}

interface FlaggedClip {
  id: number;
  clip_id: number;
  reported_by: string;
  reason: string;
  details: string | null;
  is_urgent: number;
  status: string;
  created_at: string;
  artist_name: string | null;
  venue_name: string | null;
  thumbnail_url: string | null;
  video_url: string;
  stream_video_id?: string | null;
  stream_playback_url?: string | null;
  stream_thumbnail_url?: string | null;
  playback_unplayable?: number | null;
  playback_unplayable_reason?: string | null;
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

interface FlaggedComment {
  id: number;
  comment_id: number;
  clip_id: number | null;
  reported_by: string;
  reason: string;
  details: string | null;
  status: string;
  is_urgent: number;
  created_at: string;
  comment_content: string | null;
  comment_is_hidden: number | null;
  comment_user_id: string | null;
  comment_user_display_name: string | null;
  comment_user_avatar: string | null;
  reporter_display_name: string | null;
}

interface FlaggedProfile {
  id: number;
  reported_user_id: string;
  reported_by: string;
  reason: string;
  details: string | null;
  status: string;
  is_urgent: number;
  created_at: string;
  reported_display_name: string | null;
  reported_avatar: string | null;
  reported_bio: string | null;
  reporter_display_name: string | null;
  is_banned: number;
}

type ModerationTab = 'clips' | 'comments' | 'profiles' | 'users';

export default function ContentModerationPanel() {
  const [activeTab, setActiveTab] = useState<ModerationTab>('clips');
  const [flaggedClips, setFlaggedClips] = useState<FlaggedClip[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [flaggedComments, setFlaggedComments] = useState<FlaggedComment[]>([]);
  const [flaggedProfiles, setFlaggedProfiles] = useState<FlaggedProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  useEffect(() => {
    if (activeTab === 'clips') {
      fetchFlaggedClips();
    } else if (activeTab === 'comments') {
      fetchFlaggedComments();
    } else if (activeTab === 'profiles') {
      fetchFlaggedProfiles();
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

  const fetchFlaggedComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/moderation/comments?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setFlaggedComments(data.flaggedComments || []);
      }
    } catch (error) {
      console.error('Failed to fetch flagged comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlaggedProfiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/moderation/profiles?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setFlaggedProfiles(data.flaggedProfiles || []);
      }
    } catch (error) {
      console.error('Failed to fetch flagged profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewComment = async (flagId: number, action: 'approve' | 'remove') => {
    try {
      const response = await fetch(`/api/admin/moderation/comments/${flagId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchFlaggedComments();
      }
    } catch (error) {
      console.error('Failed to review comment:', error);
    }
  };

  const handleReviewProfile = async (flagId: number, action: 'approve' | 'actioned') => {
    try {
      const response = await fetch(`/api/admin/moderation/profiles/${flagId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchFlaggedProfiles();
      }
    } catch (error) {
      console.error('Failed to review profile report:', error);
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
    if (!confirm('Are you sure you want to permanently delete this clip? Superadmin access is required.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clips/${clipId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFlaggedClips();
      } else {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        alert(errBody.error || 'Could not delete clip. Superadmin access is required.');
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
        if (activeTab === 'profiles') {
          fetchFlaggedProfiles();
        } else {
          fetchFlaggedUsers();
        }
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
        if (activeTab === 'profiles') {
          fetchFlaggedProfiles();
        } else {
          fetchFlaggedUsers();
        }
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
    if (lower.includes('spam')) return 'text-momentum-ember';
    if (lower.includes('inappropriate') || lower.includes('nsfw')) return 'text-red-400';
    if (lower.includes('copyright')) return 'text-momentum-ember';
    if (lower.includes('unplayable')) return 'text-amber-400';
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

  const query = searchQuery.toLowerCase();

  const filteredComments = flaggedComments.filter(flag =>
    !searchQuery ||
    flag.comment_content?.toLowerCase().includes(query) ||
    flag.comment_user_display_name?.toLowerCase().includes(query) ||
    reportReasonLabel(flag.reason).toLowerCase().includes(query)
  );

  const filteredProfiles = flaggedProfiles.filter(flag =>
    !searchQuery ||
    flag.reported_display_name?.toLowerCase().includes(query) ||
    reportReasonLabel(flag.reason).toLowerCase().includes(query)
  );

  const urgentBadge = (isUrgent: number) =>
    isUrgent === 1 ? (
      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold">
        URGENT
      </span>
    ) : null;

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
            onClick={() => setActiveTab('comments')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'comments'
                ? 'text-red-400 border-b-2 border-red-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <span>Reported Comments</span>
              {flaggedComments.filter(c => c.status === 'pending').length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs text-white">
                  {flaggedComments.filter(c => c.status === 'pending').length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'profiles'
                ? 'text-red-400 border-b-2 border-red-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <UserX className="w-5 h-5" />
              <span>Reported Profiles</span>
              {flaggedProfiles.filter(p => p.status === 'pending').length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs text-white">
                  {flaggedProfiles.filter(p => p.status === 'pending').length}
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
              placeholder={
                activeTab === 'clips'
                  ? 'Search clips...'
                  : activeTab === 'comments'
                    ? 'Search comments...'
                    : 'Search users...'
              }
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
            />
          </div>
          {activeTab !== 'users' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-flare"
            >
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value={activeTab === 'profiles' ? 'actioned' : 'removed'}>
                {activeTab === 'profiles' ? 'Actioned' : 'Removed'}
              </option>
              <option value="all">All</option>
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin mx-auto" />
        </div>
      ) : activeTab === 'clips' ? (
        <div className="space-y-4">
          {filteredClips.length === 0 ? (
            <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No flagged clips found</p>
            </div>
          ) : (
            filteredClips.map((flag) => (
              <div
                key={flag.id}
                className="glass-panel border border-red-500/20 rounded-xl p-6"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Clip Preview */}
                  <div className="lg:w-64 flex-shrink-0">
                    <ClipPosterImage
                      clip={{
                        thumbnail_url: flag.thumbnail_url,
                        video_url: flag.video_url,
                        stream_video_id: flag.stream_video_id,
                        stream_playback_url: flag.stream_playback_url,
                        stream_thumbnail_url: flag.stream_thumbnail_url,
                      }}
                      alt="Clip thumbnail"
                      className="w-full h-40 rounded-lg object-cover"
                    />
                    <div className="mt-2 text-sm">
                      {flag.artist_name && (
                        <div className="text-momentum-rose font-medium">{flag.artist_name}</div>
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
                            {moderationReasonLabel(flag.reason)}
                          </span>
                          {urgentBadge(flag.is_urgent)}
                          {flag.reason === 'unplayable_video' || flag.playback_unplayable === 1 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Hidden from feeds
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          {flag.reported_by === PLAYBACK_SYSTEM_REPORTER
                            ? `Flagged by playback monitor on ${formatTimestamp(flag.created_at)}`
                            : `Reported by ${flag.reporter_display_name || 'Anonymous'} on ${formatTimestamp(flag.created_at)}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          Uploaded by {flag.clip_user_display_name || 'Anonymous'}
                        </div>
                        {flag.details ? (
                          <p className="mt-2 text-sm text-gray-300">“{flag.details}”</p>
                        ) : null}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        flag.status === 'pending' ? 'bg-momentum-ember/15 text-momentum-ember' :
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
                          <span>
                            {flag.reason === 'unplayable_video'
                              ? 'Dismiss flag (stays out of feeds)'
                              : 'Approve (Keep Clip)'}
                          </span>
                        </button>
                        <button
                          onClick={() => handleReviewClip(flag.id, 'remove')}
                          className="px-4 py-2 bg-momentum-ember/15 border border-momentum-ember/25 rounded-lg text-momentum-ember hover:bg-momentum-ember/25 transition-colors flex items-center space-x-2"
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
                          className="px-4 py-2 bg-momentum-flare/20 border border-momentum-flare/30 rounded-lg text-momentum-flare hover:bg-momentum-flare/30 transition-colors flex items-center space-x-2"
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
      ) : activeTab === 'comments' ? (
        <div className="space-y-4">
          {filteredComments.length === 0 ? (
            <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No reported comments found</p>
            </div>
          ) : (
            filteredComments.map((flag) => (
              <div key={flag.id} className="glass-panel border border-red-500/20 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Flag className="w-5 h-5 text-red-400" />
                      <span className="font-semibold text-red-400">
                        {reportReasonLabel(flag.reason)}
                      </span>
                      {urgentBadge(flag.is_urgent)}
                    </div>
                    <div className="text-sm text-gray-400">
                      Reported by {flag.reporter_display_name || 'Anonymous'} on{' '}
                      {formatTimestamp(flag.created_at)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Posted by {flag.comment_user_display_name || 'Anonymous'}
                      {flag.clip_id ? ` on clip ${flag.clip_id}` : ''}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                      flag.status === 'pending'
                        ? 'bg-momentum-ember/15 text-momentum-ember'
                        : flag.status === 'approved'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {flag.status.toUpperCase()}
                  </span>
                </div>

                <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-gray-200">{flag.comment_content || '(comment deleted)'}</p>
                  {flag.comment_is_hidden === 1 ? (
                    <p className="mt-2 text-xs text-momentum-ember">
                      Currently hidden from the app.
                    </p>
                  ) : null}
                </div>

                {flag.details ? (
                  <p className="mb-4 text-sm text-gray-300">Reporter note: “{flag.details}”</p>
                ) : null}

                {flag.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleReviewComment(flag.id, 'approve')}
                      className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors flex items-center space-x-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve (Keep Comment)</span>
                    </button>
                    <button
                      onClick={() => handleReviewComment(flag.id, 'remove')}
                      className="px-4 py-2 bg-momentum-ember/15 border border-momentum-ember/25 rounded-lg text-momentum-ember hover:bg-momentum-ember/25 transition-colors flex items-center space-x-2"
                    >
                      <EyeOff className="w-4 h-4" />
                      <span>Hide Comment</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'profiles' ? (
        <div className="space-y-4">
          {filteredProfiles.length === 0 ? (
            <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No reported profiles found</p>
            </div>
          ) : (
            filteredProfiles.map((flag) => (
              <div key={flag.id} className="glass-panel border border-red-500/20 rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center space-x-4 min-w-0">
                    <UserAvatar
                      imageUrl={flag.reported_avatar}
                      displayName={flag.reported_display_name}
                      seed={flag.reported_user_id}
                      alt={flag.reported_display_name || 'User'}
                      sizeClass="w-16 h-16"
                      letterClassName="text-xl font-semibold"
                    />
                    <div className="min-w-0">
                      <div className="text-white font-semibold mb-1">
                        {flag.reported_display_name || 'Anonymous'}
                      </div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm text-red-400">
                          {reportReasonLabel(flag.reason)}
                        </span>
                        {urgentBadge(flag.is_urgent)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Reported by {flag.reporter_display_name || 'Anonymous'} on{' '}
                        {formatTimestamp(flag.created_at)}
                      </div>
                      {flag.details ? (
                        <p className="mt-2 text-sm text-gray-300">“{flag.details}”</p>
                      ) : null}
                      {flag.is_banned === 1 && (
                        <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                          BANNED
                        </span>
                      )}
                    </div>
                  </div>

                  {flag.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/users/${flag.reported_user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-momentum-flare/20 border border-momentum-flare/30 rounded-lg text-momentum-flare hover:bg-momentum-flare/30 transition-colors flex items-center space-x-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Profile</span>
                      </a>
                      <button
                        onClick={() => handleReviewProfile(flag.id, 'approve')}
                        className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        No Action
                      </button>
                      <button
                        onClick={() => handleBanUser(flag.reported_user_id, 7)}
                        className="px-4 py-2 bg-momentum-ember/15 border border-momentum-ember/25 rounded-lg text-momentum-ember hover:bg-momentum-ember/25 transition-colors"
                      >
                        Ban 7 Days
                      </button>
                      <button
                        onClick={() => handleReviewProfile(flag.id, 'actioned')}
                        className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        Mark Actioned
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No flagged users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.mocha_user_id}
                className="glass-panel border border-red-500/20 rounded-xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <UserAvatar
                      imageUrl={user.profile_image_url}
                      displayName={user.display_name}
                      seed={user.mocha_user_id}
                      alt={user.display_name || 'User'}
                      sizeClass="w-16 h-16"
                      letterClassName="text-xl font-semibold"
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
                          className="px-4 py-2 bg-momentum-ember/15 border border-momentum-ember/25 rounded-lg text-momentum-ember hover:bg-momentum-ember/25 transition-colors"
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
