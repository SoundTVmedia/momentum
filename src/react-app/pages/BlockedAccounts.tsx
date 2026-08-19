import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2 } from 'lucide-react';
import ResourcesPageLayout from '@/react-app/components/ResourcesPageLayout';
import UserAvatar from '@/react-app/components/UserAvatar';
import { dispatchUserBlocksChanged } from '@/react-app/lib/user-block-events';

type BlockedAccount = {
  blocked_id: string;
  created_at: string;
  display_name: string | null;
  profile_image_url: string | null;
};

export default function BlockedAccounts() {
  const { user, isPending } = useAuth();
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Blocked accounts — Feedback';
    return () => {
      document.title = 'FEEDBACK - Where live music lives.';
    };
  }, []);

  const loadBlocks = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/users/me/blocks', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { blocked?: BlockedAccount[] };
        setAccounts(data.blocked ?? []);
      }
    } catch (err) {
      console.error('Failed to load blocked accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isPending) return;
    void loadBlocks();
  }, [isPending, loadBlocks]);

  const unblock = async (blockedId: string) => {
    setPendingId(blockedId);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(blockedId)}/block`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setAccounts((prev) => prev.filter((account) => account.blocked_id !== blockedId));
        dispatchUserBlocksChanged(blockedId, false);
      }
    } catch (err) {
      console.error('Failed to unblock:', err);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <ResourcesPageLayout>
      <header className="mb-10">
        <h1 className="fb-hero-title">Blocked accounts</h1>
        <p className="fb-section-subtitle mt-4">
          Blocking is instant and doesn’t need us. A blocked account can’t see your content, you
          can’t see theirs, and any follow between you is removed.
        </p>
      </header>

      {isPending || loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-momentum-flare" />
        </div>
      ) : !user ? (
        <p className="text-gray-300">
          <Link to="/auth" className="text-momentum-flare transition-colors hover:text-white">
            Sign in
          </Link>{' '}
          to see the accounts you’ve blocked.
        </p>
      ) : accounts.length === 0 ? (
        <div className="glass-panel rounded-xl p-6 text-gray-300">
          You haven’t blocked anyone. You can block someone from the ··· menu on any clip, comment,
          or profile.
        </div>
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <li
              key={account.blocked_id}
              className="glass-panel flex items-center justify-between gap-4 rounded-xl p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  imageUrl={account.profile_image_url}
                  displayName={account.display_name}
                  seed={account.blocked_id}
                  alt={account.display_name || 'Blocked account'}
                  sizeClass="w-11 h-11"
                  letterClassName="text-sm font-semibold"
                  className="border border-white/15"
                />
                <span className="truncate font-medium text-white">
                  {account.display_name || 'Feedback user'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void unblock(account.blocked_id)}
                disabled={pendingId === account.blocked_id}
                className="shrink-0 rounded-xl border border-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-60"
              >
                {pendingId === account.blocked_id ? 'Unblocking…' : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ResourcesPageLayout>
  );
}
