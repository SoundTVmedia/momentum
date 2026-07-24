import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, MapPin, Music, X } from 'lucide-react';
import { apiFetch } from '@/react-app/lib/apiFetch';
import UserAvatar from '@/react-app/components/UserAvatar';
import { useFollow } from '@/react-app/hooks/useFollow';
import { artistPath, venuePath } from '@/shared/app-paths';
import { displayMediaUrl } from '@/shared/media-proxy';

export type FollowingUserRow = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  role: string;
  is_verified: number;
};

export type FollowingArtistRow = {
  artist_id: number;
  name: string;
  image_url: string | null;
};

export type FollowingVenueRow = {
  venue_id: number;
  name: string;
  location: string | null;
  image_url: string | null;
};

type FollowingUsersModalProps = {
  onClose: () => void;
  onFollowingChanged?: () => void;
};

export default function FollowingUsersModal({
  onClose,
  onFollowingChanged,
}: FollowingUsersModalProps) {
  const navigate = useNavigate();
  const {
    toggleFollow,
    toggleFollowArtist,
    toggleFollowVenue,
    isLoading,
    isArtistFollowLoading,
    isVenueFollowLoading,
  } = useFollow();

  const [users, setUsers] = useState<FollowingUserRow[]>([]);
  const [artists, setArtists] = useState<FollowingArtistRow[]>([]);
  const [venues, setVenues] = useState<FollowingVenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/users/me/following/list', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to load following');
      }
      const data = (await res.json()) as {
        users?: FollowingUserRow[];
        artists?: FollowingArtistRow[];
        venues?: FollowingVenueRow[];
      };
      setUsers(Array.isArray(data.users) ? data.users : []);
      setArtists(Array.isArray(data.artists) ? data.artists : []);
      setVenues(Array.isArray(data.venues) ? data.venues : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load following');
      setUsers([]);
      setArtists([]);
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const onChanged = () => void loadList();
    window.addEventListener('following-changed', onChanged);
    return () => window.removeEventListener('following-changed', onChanged);
  }, [loadList]);

  const notifyChanged = () => {
    onFollowingChanged?.();
  };

  const handleUnfollowUser = async (userId: string) => {
    const result = await toggleFollow(userId);
    if (result.success && !result.following) {
      setUsers((prev) => prev.filter((u) => u.mocha_user_id !== userId));
      notifyChanged();
    }
  };

  const handleUnfollowArtist = async (artist: FollowingArtistRow) => {
    const result = await toggleFollowArtist(artist.artist_id, artist.name);
    if (result.success && !result.following) {
      setArtists((prev) => prev.filter((a) => a.name.toLowerCase() !== artist.name.toLowerCase()));
      notifyChanged();
    }
  };

  const handleUnfollowVenue = async (venue: FollowingVenueRow) => {
    const result = await toggleFollowVenue(venue.venue_id);
    if (result.success && !result.following) {
      setVenues((prev) => prev.filter((v) => v.venue_id !== venue.venue_id));
      notifyChanged();
    }
  };

  const isEmpty = !loading && !error && users.length === 0 && artists.length === 0 && venues.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-w-md w-full bg-black/95 border border-momentum-rose/20 rounded-xl p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="following-users-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="following-users-title" className="text-xl font-bold text-white">
            Following
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-500 text-xs mb-4">
          Tap Unfollow to stop following, or open a profile from the name.
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-momentum-flare animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-6">{error}</p>
        ) : isEmpty ? (
          <p className="text-gray-400 text-sm text-center py-6">
            You are not following anyone yet. Visit profiles, artists, or venues and tap Follow.
          </p>
        ) : (
          <div className="space-y-6">
            {users.length > 0 ? (
              <section>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">People</h4>
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li
                      key={u.mocha_user_id}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/users/${u.mocha_user_id}`);
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <UserAvatar
                          imageUrl={u.profile_image_url}
                          displayName={u.display_name}
                          seed={u.mocha_user_id}
                          alt={u.display_name || 'User'}
                          sizeClass="w-11 h-11"
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate">
                            {u.display_name || 'Anonymous User'}
                          </div>
                          <div className="text-gray-400 text-sm capitalize truncate">{u.role}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnfollowUser(u.mocha_user_id)}
                        disabled={isLoading(u.mocha_user_id)}
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/20 text-gray-300 hover:text-white hover:border-momentum-rose/50 disabled:opacity-50"
                      >
                        {isLoading(u.mocha_user_id) ? '…' : 'Unfollow'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {artists.length > 0 ? (
              <section>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Artists</h4>
                <ul className="space-y-2">
                  {artists.map((a) => (
                    <li
                      key={`${a.artist_id}-${a.name}`}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(artistPath(a.name));
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        {a.image_url ? (
                          <img
                            src={displayMediaUrl(a.image_url)}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-momentum-ember/30 flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5 text-momentum-flare" />
                          </div>
                        )}
                        <div className="text-white font-semibold truncate">{a.name}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnfollowArtist(a)}
                        disabled={isArtistFollowLoading(a.artist_id, a.name)}
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/20 text-gray-300 hover:text-white hover:border-momentum-rose/50 disabled:opacity-50"
                      >
                        {isArtistFollowLoading(a.artist_id, a.name) ? '…' : 'Unfollow'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {venues.length > 0 ? (
              <section>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Venues</h4>
                <ul className="space-y-2">
                  {venues.map((v) => (
                    <li
                      key={v.venue_id}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(venuePath(v.name));
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        {v.image_url ? (
                          <img
                            src={displayMediaUrl(v.image_url)}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-momentum-flare/20 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-momentum-flare" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate">{v.name}</div>
                          {v.location ? (
                            <div className="text-gray-400 text-sm truncate">{v.location}</div>
                          ) : null}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnfollowVenue(v)}
                        disabled={isVenueFollowLoading(v.venue_id)}
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/20 text-gray-300 hover:text-white hover:border-momentum-flare/50 disabled:opacity-50"
                      >
                        {isVenueFollowLoading(v.venue_id) ? '…' : 'Unfollow'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
