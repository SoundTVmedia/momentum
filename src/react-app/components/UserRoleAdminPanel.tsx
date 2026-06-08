import { useState } from 'react';
import { Ban, Loader2, Search, Trash2, UserCheck, Users } from 'lucide-react';
import UserAvatar from '@/react-app/components/UserAvatar';
import {
  COMMUNITY_ROLES,
  COMMUNITY_ROLE_LABELS,
  type CommunityRole,
} from '@/shared/user-roles';
import type { ExtendedMochaUser } from '@/shared/types';

type SearchUser = {
  mocha_user_id: string;
  display_name: string | null;
  role: string;
  is_admin: number;
  is_moderator: number;
  is_superadmin: number;
  is_suspended: number;
  profile_image_url: string | null;
};

type UserRoleAdminPanelProps = {
  extendedUser: ExtendedMochaUser | null;
};

export default function UserRoleAdminPanel({ extendedUser }: UserRoleAdminPanelProps) {
  const isSuperAdmin = extendedUser?.profile?.is_superadmin === 1;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      return;
    }

    setSearching(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = (await response.json()) as { users: SearchUser[] };
      setUsers(data.users || []);
    } catch {
      setError('Could not search users. Try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async (user: SearchUser) => {
    setSavingId(user.mocha_user_id);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, unknown> = { role: user.role };
      if (isSuperAdmin) {
        body.is_admin = user.is_admin === 1;
        body.is_moderator = user.is_moderator === 1;
        body.is_superadmin = user.is_superadmin === 1;
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.mocha_user_id)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not update user');
      }

      const updated = (await response.json()) as SearchUser;
      setUsers((prev) =>
        prev.map((u) => (u.mocha_user_id === updated.mocha_user_id ? { ...u, ...updated } : u)),
      );
      setSuccess(`Updated ${updated.display_name || updated.mocha_user_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user');
    } finally {
      setSavingId(null);
    }
  };

  const handleSuspend = async (user: SearchUser) => {
    const reason = window.prompt('Suspension reason (optional):') ?? '';
    const durationRaw = window.prompt('Suspend for how many days? Leave blank for permanent suspension.');
    const duration_days =
      durationRaw != null && durationRaw.trim() !== '' ? Number.parseInt(durationRaw, 10) : null;

    if (durationRaw != null && durationRaw.trim() !== '' && Number.isNaN(duration_days)) {
      setError('Invalid suspension duration.');
      return;
    }

    if (
      !window.confirm(
        `Suspend ${user.display_name || user.mocha_user_id}? They will be signed out and blocked from posting.`,
      )
    ) {
      return;
    }

    setModeratingId(user.mocha_user_id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.mocha_user_id)}/suspend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() || null, duration_days }),
        },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not suspend user');
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.mocha_user_id === user.mocha_user_id ? { ...u, is_suspended: 1 } : u,
        ),
      );
      setSuccess(`Suspended ${user.display_name || user.mocha_user_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not suspend user');
    } finally {
      setModeratingId(null);
    }
  };

  const handleUnsuspend = async (user: SearchUser) => {
    if (!window.confirm(`Restore access for ${user.display_name || user.mocha_user_id}?`)) {
      return;
    }

    setModeratingId(user.mocha_user_id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.mocha_user_id)}/unsuspend`,
        { method: 'POST' },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not unsuspend user');
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.mocha_user_id === user.mocha_user_id ? { ...u, is_suspended: 0 } : u,
        ),
      );
      setSuccess(`Restored ${user.display_name || user.mocha_user_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unsuspend user');
    } finally {
      setModeratingId(null);
    }
  };

  const handleDeleteUser = async (user: SearchUser) => {
    if (
      !window.confirm(
        `Permanently delete ${user.display_name || user.mocha_user_id}? This removes their profile, auth accounts, and all clips. This cannot be undone.`,
      )
    ) {
      return;
    }

    setModeratingId(user.mocha_user_id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.mocha_user_id)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delete_clips: true }),
        },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not delete user');
      }
      setUsers((prev) => prev.filter((u) => u.mocha_user_id !== user.mocha_user_id));
      setSuccess(`Deleted ${user.display_name || user.mocha_user_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user');
    } finally {
      setModeratingId(null);
    }
  };

  const updateUser = (userId: string, patch: Partial<SearchUser>) => {
    setUsers((prev) =>
      prev.map((u) => (u.mocha_user_id === userId ? { ...u, ...patch } : u)),
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">User Roles</h2>
        <p className="text-gray-400">
          New users start as Fans. Assign community roles and staff permissions here.
          {!isSuperAdmin && ' Only superadmins can change admin permissions.'}
          {isSuperAdmin &&
            ' Superadmins can also suspend or permanently delete accounts below.'}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by display name or user ID..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
          />
        </div>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold disabled:opacity-50"
        >
          {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
          {success}
        </div>
      )}

      {users.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Search for a user to manage their role.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.mocha_user_id}
              className="glass-panel border border-white/10 rounded-xl p-6"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar
                      imageUrl={user.profile_image_url}
                      displayName={user.display_name}
                      seed={user.mocha_user_id}
                      sizeClass="w-12 h-12"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold truncate">
                          {user.display_name || 'Unnamed user'}
                        </p>
                        {user.is_suspended === 1 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm truncate">{user.mocha_user_id}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateUser(user.mocha_user_id, { role: e.target.value })
                      }
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-flare"
                    >
                      {COMMUNITY_ROLES.map((role) => (
                        <option key={role} value={role} className="bg-gray-900">
                          {COMMUNITY_ROLE_LABELS[role as CommunityRole]}
                        </option>
                      ))}
                    </select>

                    {isSuperAdmin && (
                      <div className="flex flex-wrap gap-3 text-sm text-gray-300">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.is_admin === 1}
                            onChange={(e) =>
                              updateUser(user.mocha_user_id, {
                                is_admin: e.target.checked ? 1 : 0,
                              })
                            }
                            className="rounded"
                          />
                          Admin
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.is_moderator === 1}
                            onChange={(e) =>
                              updateUser(user.mocha_user_id, {
                                is_moderator: e.target.checked ? 1 : 0,
                              })
                            }
                            className="rounded"
                          />
                          Moderator
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.is_superadmin === 1}
                            onChange={(e) =>
                              updateUser(user.mocha_user_id, {
                                is_superadmin: e.target.checked ? 1 : 0,
                              })
                            }
                            className="rounded"
                          />
                          Superadmin
                        </label>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleSave(user)}
                      disabled={savingId === user.mocha_user_id}
                      className="px-4 py-2 momentum-grad-interactive rounded-lg text-white font-semibold disabled:opacity-50"
                    >
                      {savingId === user.mocha_user_id ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        'Save role'
                      )}
                    </button>
                  </div>
                </div>

                {isSuperAdmin && user.mocha_user_id !== extendedUser?.id && user.is_superadmin !== 1 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                    {user.is_suspended === 1 ? (
                      <button
                        type="button"
                        onClick={() => void handleUnsuspend(user)}
                        disabled={moderatingId === user.mocha_user_id}
                        className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 hover:bg-green-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {moderatingId === user.mocha_user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSuspend(user)}
                        disabled={moderatingId === user.mocha_user_id}
                        className="px-4 py-2 bg-momentum-ember/15 border border-momentum-ember/25 rounded-lg text-momentum-ember hover:bg-momentum-ember/25 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {moderatingId === user.mocha_user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4" />
                        )}
                        Suspend
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteUser(user)}
                      disabled={moderatingId === user.mocha_user_id}
                      className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {moderatingId === user.mocha_user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete user
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
