import { useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
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
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <UserAvatar
                    imageUrl={user.profile_image_url}
                    displayName={user.display_name}
                    seed={user.mocha_user_id}
                    sizeClass="w-12 h-12"
                  />
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">
                      {user.display_name || 'Unnamed user'}
                    </p>
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
                            updateUser(user.mocha_user_id, { is_admin: e.target.checked ? 1 : 0 })
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
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
