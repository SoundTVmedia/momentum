import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, Flag, Loader2, Trash2, UserCheck } from 'lucide-react';

type SuperadminProfileModerationBarProps = {
  targetUserId: string;
  targetDisplayName: string | null;
  onUpdated?: () => void;
};

type ModerationStatus = {
  is_suspended: number;
  staff_flagged: number;
  staff_flag_reason: string | null;
  is_superadmin: number;
};

export default function SuperadminProfileModerationBar({
  targetUserId,
  targetDisplayName,
  onUpdated,
}: SuperadminProfileModerationBarProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ModerationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/super/users/${encodeURIComponent(targetUserId)}/moderation`,
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not load moderation status');
      }
      setStatus((await response.json()) as ModerationStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load moderation status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading moderation tools…
      </div>
    );
  }

  if (!status || status.is_superadmin === 1) {
    return null;
  }

  const name = targetDisplayName || targetUserId;

  const handleRestrict = async () => {
    const reason = window.prompt(`Restriction reason for ${name} (optional):`) ?? '';
    if (
      !window.confirm(
        `Restrict ${name}? They will be signed out and blocked from posting.`,
      )
    ) {
      return;
    }

    setActing('restrict');
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(targetUserId)}/suspend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not restrict user');
      }
      await loadStatus();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restrict user');
    } finally {
      setActing(null);
    }
  };

  const handleUnrestrict = async () => {
    if (!window.confirm(`Restore access for ${name}?`)) {
      return;
    }

    setActing('unrestrict');
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(targetUserId)}/unsuspend`,
        { method: 'POST' },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not restore access');
      }
      await loadStatus();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore access');
    } finally {
      setActing(null);
    }
  };

  const handleFlag = async () => {
    const reason = window.prompt(`Flag reason for ${name}:`)?.trim();
    if (!reason) {
      return;
    }

    setActing('flag');
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(targetUserId)}/flag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not flag user');
      }
      await loadStatus();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not flag user');
    } finally {
      setActing(null);
    }
  };

  const handleUnflag = async () => {
    if (!window.confirm(`Remove flag from ${name}?`)) {
      return;
    }

    setActing('unflag');
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(targetUserId)}/unflag`,
        { method: 'POST' },
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not remove flag');
      }
      await loadStatus();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove flag');
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Permanently delete ${name}? This removes their profile, auth accounts, and all clips.`,
      )
    ) {
      return;
    }

    setActing('delete');
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(targetUserId)}`,
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
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user');
      setActing(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-momentum-flare/30 bg-momentum-flare/10 p-4 sm:p-5">
      <p className="text-sm font-semibold text-momentum-flare mb-3">Superadmin moderation</p>
      {error && <p className="text-red-300 text-sm mb-3">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {status.is_suspended === 1 ? (
          <button
            type="button"
            onClick={() => void handleUnrestrict()}
            disabled={acting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-semibold disabled:opacity-50"
          >
            {acting === 'unrestrict' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            Remove restriction
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleRestrict()}
            disabled={acting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-momentum-ember/15 border border-momentum-ember/25 text-momentum-ember text-sm font-semibold disabled:opacity-50"
          >
            {acting === 'restrict' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Ban className="w-4 h-4" />
            )}
            Restrict
          </button>
        )}
        {status.staff_flagged === 1 ? (
          <button
            type="button"
            onClick={() => void handleUnflag()}
            disabled={acting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-semibold disabled:opacity-50"
          >
            {acting === 'unflag' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Flag className="w-4 h-4" />
            )}
            Clear flag
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleFlag()}
            disabled={acting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-momentum-ember/15 border border-momentum-ember/25 text-momentum-ember text-sm font-semibold disabled:opacity-50"
          >
            {acting === 'flag' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Flag className="w-4 h-4" />
            )}
            Flag
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={acting !== null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-semibold disabled:opacity-50"
        >
          {acting === 'delete' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Delete user
        </button>
      </div>
      {status.staff_flagged === 1 && status.staff_flag_reason && (
        <p className="text-gray-400 text-xs mt-3">Flag note: {status.staff_flag_reason}</p>
      )}
    </div>
  );
}
