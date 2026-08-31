import { Loader2 } from 'lucide-react';

export function FollowSearchActionLabel({
  following,
  loading = false,
}: {
  following: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-momentum-flare" aria-hidden />;
  }
  return (
    <span
      className={`shrink-0 text-xs font-semibold ${following ? 'text-momentum-flare' : 'text-white'}`}
    >
      {following ? 'Unfollow' : 'Follow'}
    </span>
  );
}

const DEFAULT_PEOPLE_FOLLOW_CLASS =
  'shrink-0 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 hover:bg-white/15 disabled:opacity-50';

export function PeopleFollowButton({
  following,
  loading = false,
  disabled = false,
  displayName,
  onToggle,
  className = DEFAULT_PEOPLE_FOLLOW_CLASS,
}: {
  following: boolean;
  loading?: boolean;
  disabled?: boolean;
  displayName?: string | null;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={className}
      aria-label={following ? `Unfollow ${displayName || 'user'}` : `Follow ${displayName || 'user'}`}
    >
      <FollowSearchActionLabel following={following} loading={loading} />
    </button>
  );
}
