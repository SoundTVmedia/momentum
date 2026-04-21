import { useState, useEffect } from 'react';
import { Shield, Download, Trash2, Lock, Eye, Bell, Tag, Loader2 } from 'lucide-react';

interface PrivacySettings {
  profile_visibility: string;
  allow_tagging: boolean;
  show_online_status: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

export default function GDPRSettings() {
  const [settings, setSettings] = useState<PrivacySettings>({
    profile_visibility: 'public',
    allow_tagging: true,
    show_online_status: true,
    email_notifications: true,
    push_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/privacy/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<PrivacySettings>) => {
    setSaving(true);
    try {
      const response = await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, ...updates }),
      });

      if (response.ok) {
        setSettings({ ...settings, ...updates });
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/gdpr/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `momentum-data-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    try {
      const response = await fetch('/api/gdpr/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });

      if (response.ok) {
        alert('Account deletion requested. This will be processed within 30 days.');
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error('Failed to request deletion:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-8">
        <Shield className="w-8 h-8 text-cyan-400" />
        <div>
          <h2 className="text-2xl font-bold text-white">Privacy & Data</h2>
          <p className="text-gray-400">Manage your privacy settings and data</p>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Privacy Settings</h3>
        
        <div className="space-y-4">
          {/* Profile Visibility */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Eye className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-white font-medium">Profile Visibility</div>
                <div className="text-sm text-gray-400">Who can see your profile</div>
              </div>
            </div>
            <select
              value={settings.profile_visibility}
              onChange={(e) => updateSettings({ profile_visibility: e.target.value })}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            >
              <option value="public">Public</option>
              <option value="followers">Followers Only</option>
              <option value="private">Private</option>
            </select>
          </div>

          {/* Allow Tagging */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Tag className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-white font-medium">Allow Tagging</div>
                <div className="text-sm text-gray-400">Let others tag you in clips</div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ allow_tagging: !settings.allow_tagging })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.allow_tagging ? 'bg-cyan-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.allow_tagging ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Show Online Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Lock className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-white font-medium">Show Online Status</div>
                <div className="text-sm text-gray-400">Let others see when you're active</div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ show_online_status: !settings.show_online_status })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.show_online_status ? 'bg-cyan-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.show_online_status ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-white font-medium">Email Notifications</div>
                <div className="text-sm text-gray-400">Receive email updates</div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ email_notifications: !settings.email_notifications })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.email_notifications ? 'bg-cyan-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.email_notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {saving && (
          <div className="mt-4 text-sm text-cyan-400 flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      {/* Data Export */}
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Export Your Data</h3>
        <p className="text-gray-300 mb-6">
          Download a copy of all your data including clips, comments, likes, and account information.
        </p>
        <button
          onClick={exportData}
          disabled={exporting}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Download Data</span>
            </>
          )}
        </button>
      </div>

      {/* Account Deletion */}
      <div className="bg-red-500/10 backdrop-blur-lg border border-red-500/30 rounded-xl p-6">
        <h3 className="text-xl font-bold text-red-400 mb-4">Delete Account</h3>
        <p className="text-gray-300 mb-6">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-xl font-semibold text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span>Delete My Account</span>
          </button>
        ) : (
          <div className="space-y-4">
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Please tell us why you're leaving (optional)"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400"
              rows={3}
            />
            <div className="flex space-x-3">
              <button
                onClick={requestDeletion}
                className="px-6 py-3 bg-red-500 rounded-xl font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Confirm Deletion
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
