import { useState, useEffect } from 'react';
import { Shield, Ban, UserX, AlertCircle, Loader2, Clock } from 'lucide-react';

interface LiveSession {
  id: number;
  title: string | null;
  status: string;
  start_time: string;
}

interface BannedUser {
  id: number;
  mocha_user_id: string;
  user_display_name: string | null;
  user_avatar: string | null;
  banned_by: string;
  banned_by_display_name: string | null;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function ChatModerationPanel() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banFormData, setBanFormData] = useState({
    user_id: '',
    reason: '',
    duration_minutes: '',
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchBannedUsers();
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/live/sessions');
      if (response.ok) {
        const data = await response.json();
        const activeSessions = (data.sessions || []).filter(
          (s: LiveSession) => s.status === 'live' || s.status === 'scheduled'
        );
        setSessions(activeSessions);
        if (activeSessions.length > 0 && !selectedSession) {
          setSelectedSession(activeSessions[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchBannedUsers = async () => {
    if (!selectedSession) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/live/${selectedSession.id}/bans`);
      if (response.ok) {
        const data = await response.json();
        setBannedUsers(data.bans || []);
      }
    } catch (error) {
      console.error('Failed to fetch banned users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!selectedSession || !banFormData.user_id) return;

    try {
      const response = await fetch(`/api/admin/live/${selectedSession.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: banFormData.user_id,
          reason: banFormData.reason || null,
          duration_minutes: banFormData.duration_minutes ? parseInt(banFormData.duration_minutes) : null,
        }),
      });

      if (response.ok) {
        fetchBannedUsers();
        setShowBanDialog(false);
        setBanFormData({ user_id: '', reason: '', duration_minutes: '' });
      }
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    if (!selectedSession) return;

    try {
      const response = await fetch(`/api/admin/live/${selectedSession.id}/ban/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchBannedUsers();
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Permanent';
    
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return 'Expired';
    if (diffMins < 60) return `${diffMins}m remaining`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h remaining`;
    
    return date.toLocaleDateString();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-4">Chat Moderation</h2>
        
        {/* Session Selector */}
        <div className="flex space-x-4 mb-6">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedSession(session)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedSession?.id === session.id
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {session.title || `Session #${session.id}`}
            </button>
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No active sessions to moderate.</p>
          </div>
        )}
      </div>

      {selectedSession && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Banned Users</h3>
            <button
              onClick={() => setShowBanDialog(true)}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 rounded-lg text-white hover:scale-105 transition-transform flex items-center space-x-2"
            >
              <Ban className="w-5 h-5" />
              <span>Ban User</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            </div>
          ) : bannedUsers.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No banned users in this session.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bannedUsers.map((ban) => (
                <div
                  key={ban.id}
                  className="bg-black/40 backdrop-blur-lg border border-red-500/20 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img
                        src={ban.user_avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=48&h=48&fit=crop&crop=face'}
                        alt={ban.user_display_name || 'User'}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div className="text-white font-semibold">
                          {ban.user_display_name || 'Anonymous'}
                        </div>
                        <div className="text-gray-400 text-sm">
                          Banned by {ban.banned_by_display_name || 'Admin'}
                        </div>
                        {ban.reason && (
                          <div className="text-gray-500 text-sm mt-1">
                            Reason: {ban.reason}
                          </div>
                        )}
                        <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatExpiry(ban.expires_at)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnbanUser(ban.mocha_user_id)}
                      className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors flex items-center space-x-2"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Unban</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ban User Dialog */}
          {showBanDialog && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gradient-to-b from-gray-900 to-black border border-red-500/30 rounded-2xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-white mb-4">Ban User from Chat</h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">User ID</label>
                    <input
                      type="text"
                      value={banFormData.user_id}
                      onChange={(e) => setBanFormData({ ...banFormData, user_id: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                      placeholder="user_abc123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Reason (optional)</label>
                    <input
                      type="text"
                      value={banFormData.reason}
                      onChange={(e) => setBanFormData({ ...banFormData, reason: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                      placeholder="Spam, harassment, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={banFormData.duration_minutes}
                      onChange={(e) => setBanFormData({ ...banFormData, duration_minutes: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                      placeholder="Leave empty for permanent ban"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowBanDialog(false)}
                    className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBanUser}
                    disabled={!banFormData.user_id}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 rounded-lg text-white hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    Ban User
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
