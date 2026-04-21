import { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Trash2, PlayCircle, PauseCircle, Calendar, Users, MessageSquare, SkipForward, BarChart3, CheckCircle } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import { useNavigate } from 'react-router';
import LiveSessionManager from './LiveSessionManager';
import ChatModerationPanel from './ChatModerationPanel';
import AnalyticsDashboard from './AnalyticsDashboard';
import ContentModerationPanel from './ContentModerationPanel';
import VerificationAdminPanel from './VerificationAdminPanel';
import type { ExtendedMochaUser } from '@/shared/types';

interface LiveSession {
  id: number;
  start_time: string;
  end_time: string;
  title: string | null;
  description: string | null;
  status: string;
  total_viewers: number;
  current_clip_id: number | null;
  created_at: string;
  updated_at: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'moderation' | 'analytics' | 'content' | 'verification'>('sessions');
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/live/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this session? This will remove all associated data.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/live/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleUpdateStatus = async (sessionId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/live/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchSessions();
      }
    } catch (error) {
      console.error('Failed to update session status:', error);
    }
  };

  const handleAdvanceClip = async (sessionId: number) => {
    try {
      const response = await fetch(`/api/admin/live/sessions/${sessionId}/advance`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          alert(data.message);
        }
        fetchSessions();
      }
    } catch (error) {
      console.error('Failed to advance clip:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'ended':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!extendedUser?.profile?.is_admin) {
    return (
      <section className="py-20 bg-gradient-to-r from-black via-purple-900/30 to-black min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-8">You need admin privileges to access this page.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform"
          >
            Return Home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-r from-black via-purple-900/30 to-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-300">Manage live sessions and moderate chat</p>
            </div>
            <Shield className="w-12 h-12 text-cyan-400" />
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-4 border-b border-white/10">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'sessions'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Live Sessions</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'moderation'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Chat Moderation</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'analytics'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Analytics</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'content'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Content Moderation</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'verification'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>Verification</span>
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'sessions' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Live Sessions</h2>
              <button
                onClick={() => {
                  setSelectedSession(null);
                  setShowSessionManager(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Session</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No live sessions yet. Create your first one!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-white">
                            {session.title || `Session #${session.id}`}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(session.status)}`}>
                            {session.status.toUpperCase()}
                          </span>
                        </div>
                        {session.description && (
                          <p className="text-gray-400 mb-3">{session.description}</p>
                        )}
                        <div className="flex items-center space-x-6 text-sm text-gray-400">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {new Date(session.start_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4" />
                            <span>{session.total_viewers} viewers</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {session.status === 'scheduled' && (
                          <button
                            onClick={() => handleUpdateStatus(session.id, 'live')}
                            className="p-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
                            title="Start Session"
                          >
                            <PlayCircle className="w-5 h-5" />
                          </button>
                        )}
                        {session.status === 'live' && (
                          <>
                            <button
                              onClick={() => handleAdvanceClip(session.id)}
                              className="p-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors"
                              title="Skip to Next Clip"
                            >
                              <SkipForward className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(session.id, 'ended')}
                              className="p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                              title="End Session"
                            >
                              <PauseCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedSession(session);
                            setShowSessionManager(true);
                          }}
                          className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="Edit Session"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showSessionManager && (
              <LiveSessionManager
                session={selectedSession}
                onClose={() => {
                  setShowSessionManager(false);
                  setSelectedSession(null);
                  fetchSessions();
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'moderation' && <ChatModerationPanel />}

        {activeTab === 'analytics' && <AnalyticsDashboard />}

        {activeTab === 'content' && <ContentModerationPanel />}

        {activeTab === 'verification' && <VerificationAdminPanel />}
      </div>
    </section>
  );
}
