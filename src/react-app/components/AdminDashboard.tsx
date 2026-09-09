import { useState, useEffect, useMemo, useRef } from 'react';
import { Shield, Plus, Edit, Trash2, PlayCircle, PauseCircle, Calendar, Users, MessageSquare, SkipForward, BarChart3, CheckCircle, UserCog, ClipboardList, Database, Gauge, ChevronDown, type LucideIcon } from 'lucide-react';
import { useAuth } from '@getmocha/users-service/react';
import { useNavigate } from 'react-router';
import LiveSessionManager from './LiveSessionManager';
import ChatModerationPanel from './ChatModerationPanel';
import AnalyticsDashboard from './AnalyticsDashboard';
import ContentModerationPanel from './ContentModerationPanel';
import VerificationAdminPanel from './VerificationAdminPanel';
import UserRoleAdminPanel from './UserRoleAdminPanel';
import ProgramApplicationsAdminPanel from './ProgramApplicationsAdminPanel';
import SuperadminClipModerationPanel from './SuperadminClipModerationPanel';
import PlaybackPerformancePanel from './PlaybackPerformancePanel';
import JamBaseQuotaPanel from './JamBaseQuotaPanel';
import type { ExtendedMochaUser } from '@/shared/types';

type AdminTab =
  | 'sessions'
  | 'moderation'
  | 'analytics'
  | 'playback'
  | 'content'
  | 'verification'
  | 'applications'
  | 'roles'
  | 'clips'
  | 'jambase';

const ADMIN_TABS: {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}[] = [
  { id: 'sessions', label: 'Live Sessions', icon: Calendar },
  { id: 'moderation', label: 'Chat Moderation', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'playback', label: 'Playback Performance', icon: Gauge, superAdminOnly: true },
  { id: 'jambase', label: 'JamBase', icon: Database },
  { id: 'content', label: 'Content Moderation', icon: Shield },
  { id: 'roles', label: 'User Roles', icon: UserCog },
  { id: 'clips', label: 'Clip Moderation', icon: Trash2, superAdminOnly: true },
  { id: 'applications', label: 'Applications', icon: ClipboardList },
  { id: 'verification', label: 'Verification', icon: CheckCircle },
];

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
  const isSuperAdmin = extendedUser?.profile?.is_superadmin === 1;
  const [activeTab, setActiveTab] = useState<AdminTab>('sessions');
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);

  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin),
    [isSuperAdmin],
  );
  const currentTab = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];
  const CurrentTabIcon = currentTab?.icon ?? Calendar;

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!tabMenuOpen) return;
    const onDocDown = (event: MouseEvent) => {
      if (
        tabMenuRef.current &&
        event.target instanceof Node &&
        !tabMenuRef.current.contains(event.target)
      ) {
        setTabMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTabMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [tabMenuOpen]);

  useEffect(() => {
    if (currentTab && currentTab.id !== activeTab) {
      setActiveTab(currentTab.id);
    }
  }, [activeTab, currentTab]);

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
        return 'bg-momentum-flare/20 text-momentum-flare border-momentum-flare/30';
      case 'ended':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!extendedUser?.profile?.is_admin && !extendedUser?.profile?.is_superadmin) {
    return (
      <section className="py-20 bg-gradient-to-r from-black via-momentum-ember/14 to-black min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-8">You need admin privileges to access this page.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 momentum-grad-interactive rounded-lg text-white hover:scale-105 transition-transform"
          >
            Return Home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-r from-black via-momentum-ember/14 to-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-300">Manage live sessions and moderate chat</p>
            </div>
            <Shield className="w-12 h-12 text-momentum-flare" />
          </div>

          <div ref={tabMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setTabMenuOpen((open) => !open)}
              aria-expanded={tabMenuOpen}
              aria-haspopup="menu"
              aria-label={`Admin section: ${currentTab?.label ?? 'Live Sessions'}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 hover:border-white/40 transition-colors"
            >
              <CurrentTabIcon className="w-5 h-5 text-momentum-flare shrink-0" aria-hidden />
              <span>{currentTab?.label ?? 'Live Sessions'}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-300 transition-transform ${tabMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {tabMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-2 min-w-[16rem] overflow-hidden rounded-xl glass-dropdown py-1 shadow-xl"
              >
                {visibleTabs.map((tab) => {
                  const selected = tab.id === activeTab;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setTabMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-white/10 text-momentum-flare'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="font-semibold">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
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
                className="px-6 py-3 momentum-grad-interactive rounded-lg text-white hover:scale-105 transition-transform flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Session</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-momentum-flare border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No live sessions yet. Create your first one!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="glass-panel border border-white/10 rounded-xl p-6 hover:border-momentum-ember/30 transition-colors"
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
                              className="p-2 bg-momentum-rose/20 border border-momentum-rose/30 rounded-lg text-momentum-rose hover:bg-momentum-rose/30 transition-colors"
                              title="Skip to Next Clip"
                            >
                              <SkipForward className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(session.id, 'ended')}
                              className="p-2 bg-momentum-ember/15 border border-momentum-ember/25 rounded-lg text-momentum-ember hover:bg-momentum-ember/20 transition-colors"
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
                          className="p-2 bg-momentum-flare/20 border border-momentum-flare/30 rounded-lg text-momentum-flare hover:bg-momentum-flare/30 transition-colors"
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

        {activeTab === 'playback' && isSuperAdmin && <PlaybackPerformancePanel />}

        {activeTab === 'jambase' && <JamBaseQuotaPanel />}

        {activeTab === 'content' && <ContentModerationPanel />}

        {activeTab === 'applications' && <ProgramApplicationsAdminPanel />}

        {activeTab === 'verification' && <VerificationAdminPanel />}

        {activeTab === 'roles' && <UserRoleAdminPanel extendedUser={extendedUser} />}

        {activeTab === 'clips' && isSuperAdmin && <SuperadminClipModerationPanel />}
      </div>
    </section>
  );
}
