import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, Flag, Loader2, MapPin, ChevronRight } from 'lucide-react';
import UserAvatar from '@/react-app/components/UserAvatar';

type RosterUser = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  city: string | null;
  location: string | null;
  role: string;
  staff_flagged: number;
  staff_flag_reason: string | null;
  is_suspended: number;
};

type ProgramRosterPanelProps = {
  programRole: 'ambassador' | 'influencer';
  title: string;
  subtitle: string;
};

export default function ProgramRosterPanel({
  programRole,
  title,
  subtitle,
}: ProgramRosterPanelProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/super/users/by-role?role=${encodeURIComponent(programRole)}`,
        );
        if (!response.ok) {
          const errBody = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || 'Could not load roster');
        }
        const data = (await response.json()) as { users: RosterUser[] };
        if (!cancelled) {
          setUsers(data.users || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load roster');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programRole]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">{title}</h1>
        <p className="mt-2 text-gray-400">{subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-400">
            No {programRole === 'ambassador' ? 'ambassadors' : 'influencers'} assigned yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <button
              key={user.mocha_user_id}
              type="button"
              onClick={() => navigate(`/users/${encodeURIComponent(user.mocha_user_id)}`)}
              className="w-full glass-panel border border-white/10 rounded-xl p-4 sm:p-5 hover:border-momentum-flare/40 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <UserAvatar
                  imageUrl={user.profile_image_url}
                  displayName={user.display_name}
                  seed={user.mocha_user_id}
                  sizeClass="w-12 h-12 sm:w-14 sm:h-14"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold truncate">
                      {user.display_name || 'Unnamed user'}
                    </p>
                    {user.is_suspended === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                        <Ban className="w-3 h-3" />
                        Restricted
                      </span>
                    )}
                    {user.staff_flagged === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-momentum-ember/15 text-momentum-ember border border-momentum-ember/30">
                        <Flag className="w-3 h-3" />
                        Flagged
                      </span>
                    )}
                  </div>
                  {(user.city || user.location) && (
                    <p className="text-gray-400 text-sm flex items-center gap-1 mt-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {user.city || user.location}
                    </p>
                  )}
                  {user.staff_flagged === 1 && user.staff_flag_reason && (
                    <p className="text-gray-500 text-xs mt-1 truncate">{user.staff_flag_reason}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
