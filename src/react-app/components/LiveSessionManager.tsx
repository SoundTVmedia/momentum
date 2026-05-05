import { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, Search, Loader2 } from 'lucide-react';
import type { ClipWithUser } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';

interface LiveSession {
  id: number;
  start_time: string;
  end_time: string;
  title: string | null;
  description: string | null;
  status: string;
}

interface ScheduleItem {
  id: number;
  clip_id: number;
  order_index: number;
  duration: number | null;
  artist_name?: string | null;
  venue_name?: string | null;
  thumbnail_url?: string | null;
}

interface ClipDurationEdit {
  scheduleId: number;
  duration: string;
}

interface Props {
  session: LiveSession | null;
  onClose: () => void;
}

export default function LiveSessionManager({ session, onClose }: Props) {
  const [formData, setFormData] = useState({
    title: session?.title || '',
    description: session?.description || '',
    start_time: session?.start_time ? new Date(session.start_time).toISOString().slice(0, 16) : '',
    end_time: session?.end_time ? new Date(session.end_time).toISOString().slice(0, 16) : '',
  });
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClipWithUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDuration, setEditingDuration] = useState<ClipDurationEdit | null>(null);

  useEffect(() => {
    if (session) {
      fetchSchedule();
    }
  }, [session]);

  const fetchSchedule = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/live/schedule?session_id=${session.id}`);
      if (response.ok) {
        const data = await response.json();
        setSchedule(data.schedule || []);
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    }
  };

  const searchClips = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`/api/search/clips?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.clips || []);
      }
    } catch (error) {
      console.error('Failed to search clips:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSaveSession = async () => {
    setSaving(true);
    try {
      const method = session ? 'PUT' : 'POST';
      const url = session ? `/api/admin/live/sessions/${session.id}` : '/api/admin/live/sessions';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || null,
          description: formData.description || null,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString(),
        }),
      });

      if (response.ok) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddClip = async (clipId: number) => {
    if (!session) return;

    try {
      const response = await fetch(`/api/admin/live/sessions/${session.id}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clipId }),
      });

      if (response.ok) {
        fetchSchedule();
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to add clip:', error);
    }
  };

  const handleRemoveClip = async (scheduleId: number) => {
    if (!session) return;

    try {
      const response = await fetch(`/api/admin/live/sessions/${session.id}/clips/${scheduleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSchedule();
      }
    } catch (error) {
      console.error('Failed to remove clip:', error);
    }
  };

  const handleUpdateDuration = async (scheduleId: number, duration: number) => {
    if (!session) return;

    try {
      const response = await fetch(`/api/admin/live/sessions/${session.id}/clips/${scheduleId}/duration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      });

      if (response.ok) {
        fetchSchedule();
        setEditingDuration(null);
      }
    } catch (error) {
      console.error('Failed to update duration:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-black border border-cyan-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {session ? 'Edit Live Session' : 'Create Live Session'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Session Details Form */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="MOMENTUM Live - Episode 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="Tonight's curated selection of the best live moments..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Schedule Management (only for existing sessions) */}
          {session && (
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Session Schedule</h3>

              {/* Search and Add Clips */}
              <div className="mb-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchClips()}
                    placeholder="Search clips to add to schedule..."
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={searchClips}
                    disabled={searching}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-black/60 border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((clip, index) => (
                      <div
                        key={clipListItemKey(clip, index)}
                        className="p-3 hover:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <img
                            src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop'}
                            alt="Clip"
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">
                              {clip.artist_name || 'Unknown Artist'}
                            </div>
                            <div className="text-gray-400 text-sm truncate">
                              {clip.venue_name || 'Unknown Venue'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddClip(clip.id)}
                          className="p-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors flex-shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Schedule */}
              <div className="space-y-2">
                {schedule.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No clips in schedule. Search and add clips above.
                  </div>
                ) : (
                  schedule.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <GripVertical className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <span className="text-cyan-400 font-bold flex-shrink-0">#{index + 1}</span>
                          <img
                            src={item.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=40&h=40&fit=crop'}
                            alt="Clip"
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">
                              {item.artist_name || 'Unknown Artist'}
                            </div>
                            <div className="text-gray-400 text-sm truncate">
                              {item.venue_name || 'Unknown Venue'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveClip(item.id)}
                          className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Duration Setting */}
                      <div className="flex items-center space-x-2 ml-16">
                        <span className="text-gray-400 text-sm">Duration:</span>
                        {editingDuration?.scheduleId === item.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={editingDuration.duration}
                              onChange={(e) => setEditingDuration({ ...editingDuration, duration: e.target.value })}
                              className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                              placeholder="180"
                              min="1"
                            />
                            <span className="text-gray-400 text-sm">seconds</span>
                            <button
                              onClick={() => handleUpdateDuration(item.id, parseInt(editingDuration.duration))}
                              className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 text-xs hover:bg-cyan-500/30"
                              disabled={!editingDuration.duration || parseInt(editingDuration.duration) <= 0}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingDuration(null)}
                              className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs hover:bg-white/20"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingDuration({ scheduleId: item.id, duration: String(item.duration || 180) })}
                            className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm hover:bg-white/20"
                          >
                            {item.duration ? `${item.duration}s` : '3m (default)'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSession}
            disabled={saving || !formData.start_time || !formData.end_time}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? 'Saving...' : session ? 'Update Session' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
