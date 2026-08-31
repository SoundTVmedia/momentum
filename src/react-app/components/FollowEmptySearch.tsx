import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Music, Search } from 'lucide-react';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import UserAvatar from '@/react-app/components/UserAvatar';
import { FollowSearchActionLabel } from '@/react-app/components/FollowSearchActionLabel';
import { FOLLOWING_CHANGED_EVENT, useFollow } from '@/react-app/hooks/useFollow';

type UnifiedArtist = { identifier: string; name: string; image: string | null };
type UnifiedVenue = { identifier: string; name: string; city: string; image: string | null };
type UnifiedFriend = {
  mocha_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  clip_count: number;
};
type UnifiedSong = {
  slug: string;
  title: string;
  artist_name: string | null;
};

export type FollowEmptySearchKind = 'artist' | 'venue' | 'song' | 'friend';

const COPY: Record<
  FollowEmptySearchKind,
  { prompt: string; placeholder: string }
> = {
  artist: {
    prompt: 'You are not following any artists yet. Search to follow one.',
    placeholder: 'Search artists',
  },
  venue: {
    prompt: 'You are not following any venues yet. Search to follow one.',
    placeholder: 'Search venues',
  },
  song: {
    prompt: 'You are not following any songs yet. Search to follow one.',
    placeholder: 'Search songs',
  },
  friend: {
    prompt: 'You are not following any friends yet. Search to follow someone.',
    placeholder: 'Search friends',
  },
};

type FollowEmptySearchProps = {
  kind: FollowEmptySearchKind;
};

export default function FollowEmptySearch({ kind }: FollowEmptySearchProps) {
  const copy = COPY[kind];
  const {
    toggleFollow,
    toggleFollowArtist,
    toggleFollowVenue,
    isFollowing,
    isFollowingArtist,
    isArtistFollowLoading,
    isLoading: isUserFollowLoading,
    hydrated: followHydrated,
  } = useFollow();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 350);
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<UnifiedArtist[]>([]);
  const [venues, setVenues] = useState<UnifiedVenue[]>([]);
  const [friends, setFriends] = useState<UnifiedFriend[]>([]);
  const [songs, setSongs] = useState<UnifiedSong[]>([]);
  const [followedVenueNames, setFollowedVenueNames] = useState<Set<string>>(new Set());
  const [followedSongSlugs, setFollowedSongSlugs] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (debounced.length < 2) {
      setArtists([]);
      setVenues([]);
      setFriends([]);
      setSongs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await apiFetch(
          `/api/search/unified-favorites?q=${encodeURIComponent(debounced)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as {
          artists?: UnifiedArtist[];
          venues?: UnifiedVenue[];
          friends?: UnifiedFriend[];
          songs?: UnifiedSong[];
        };
        if (cancelled) return;
        setArtists(data.artists ?? []);
        setVenues(data.venues ?? []);
        setFriends(data.friends ?? []);
        setSongs(data.songs ?? []);
      } catch {
        if (!cancelled) setError('Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const loadFollowedCatalog = useCallback(async () => {
    try {
      const [listRes, songsRes] = await Promise.all([
        apiFetch('/api/users/me/following/list', { cache: 'no-store' }),
        apiFetch('/api/users/me/favorites?type=song', { cache: 'no-store' }),
      ]);
      if (listRes.ok) {
        const data = (await listRes.json()) as { venues?: { name?: string | null }[] };
        setFollowedVenueNames(
          new Set(
            (data.venues ?? [])
              .map((row) => (row.name ?? '').trim().toLowerCase())
              .filter(Boolean),
          ),
        );
      }
      if (songsRes.ok) {
        const data = (await songsRes.json()) as { favorites?: { entity_key?: string }[] };
        setFollowedSongSlugs(
          new Set(
            (data.favorites ?? [])
              .map((row) => (row.entity_key ?? '').trim().toLowerCase())
              .filter(Boolean),
          ),
        );
      }
    } catch {
      /* keep current lists */
    }
  }, []);

  useEffect(() => {
    void loadFollowedCatalog();
    const refresh = () => void loadFollowedCatalog();
    window.addEventListener(FOLLOWING_CHANGED_EVENT, refresh);
    window.addEventListener('favorite-artists-changed', refresh);
    return () => {
      window.removeEventListener(FOLLOWING_CHANGED_EVENT, refresh);
      window.removeEventListener('favorite-artists-changed', refresh);
    };
  }, [loadFollowedCatalog]);

  const added = (message: string) => {
    setStatus(message);
    setError(null);
    window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    window.dispatchEvent(new CustomEvent(FOLLOWING_CHANGED_EVENT));
  };

  const addArtist = async (name: string) => {
    setBusyKey(`artist:${name}`);
    try {
      const result = await toggleFollowArtist(0, name);
      if (!result.success) throw new Error('Could not update artist follow');
      setStatus(result.following ? `Following ${name}` : `Unfollowed ${name}`);
      setError(null);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not update artist follow'));
    } finally {
      setBusyKey(null);
    }
  };

  const addVenue = async (venue: UnifiedVenue) => {
    setBusyKey(`venue:${venue.identifier || venue.name}`);
    try {
      const result = await toggleFollowVenue(0, venue.name, venue.identifier || null);
      if (!result.success) throw new Error('Could not update venue follow');
      setStatus(result.following ? `Following ${venue.name}` : `Unfollowed ${venue.name}`);
      setError(null);
      void loadFollowedCatalog();
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not update venue follow'));
    } finally {
      setBusyKey(null);
    }
  };

  const addSong = async (song: UnifiedSong) => {
    setBusyKey(`song:${song.slug}`);
    const already = followedSongSlugs.has(song.slug.toLowerCase());
    try {
      if (already) {
        const res = await apiFetch(
          `/api/users/me/favorites/song/${encodeURIComponent(song.slug)}`,
          { method: 'DELETE' },
        );
        if (!res.ok) throw new Error(await res.text());
        added(`Unfollowed ${song.title}`);
      } else {
        const res = await apiFetch('/api/users/me/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'song', name: song.title || song.slug }),
        });
        if (!res.ok) throw new Error(await res.text());
        added(`Following ${song.title}`);
      }
    } catch (err) {
      setError(apiFetchErrorMessage(err, already ? 'Could not unfollow song' : 'Could not save song'));
    } finally {
      setBusyKey(null);
    }
  };

  const addFriend = async (friend: UnifiedFriend) => {
    setBusyKey(`friend:${friend.mocha_user_id}`);
    try {
      const result = await toggleFollow(friend.mocha_user_id);
      if (!result.success) throw new Error('Could not update follow');
      const label = friend.display_name || 'friend';
      setStatus(result.following ? `Following ${label}` : `Unfollowed ${label}`);
      setError(null);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not update follow'));
    } finally {
      setBusyKey(null);
    }
  };

  const rows =
    kind === 'artist'
      ? artists
      : kind === 'venue'
        ? venues
        : kind === 'friend'
          ? friends
          : songs;
  const hasResults = rows.length > 0;

  return (
    <div className="py-2">
      <p className="text-sm text-gray-400 mb-3">{copy.prompt}</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.placeholder}
          className="w-full rounded-xl border border-white/15 bg-black/40 py-3 pl-10 pr-4 text-base text-white placeholder:text-white/40 focus:border-momentum-ember/60 focus:outline-none"
          autoComplete="off"
        />
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching…
        </div>
      ) : null}
      {debounced.length >= 2 && !loading && !hasResults ? (
        <p className="mt-4 text-sm text-gray-400">No matches yet. Try another name.</p>
      ) : null}

      {kind === 'artist' && artists.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {artists.map((artist) => {
            const alreadyFollowing = isFollowingArtist(0, artist.name);
            const artistBusy =
              busyKey === `artist:${artist.name}` || isArtistFollowLoading(0, artist.name);
            return (
              <li key={artist.identifier || artist.name}>
                <button
                  type="button"
                  onClick={() => void addArtist(artist.name)}
                  disabled={!followHydrated || artistBusy}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
                  {artist.image ? (
                    <img src={artist.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-momentum-rose/20">
                      <Music className="h-4 w-4 text-momentum-flare" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-white">{artist.name}</span>
                  <FollowSearchActionLabel following={alreadyFollowing} loading={artistBusy} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {kind === 'venue' && venues.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {venues.map((venue) => {
            const alreadyFollowing = followedVenueNames.has(venue.name.trim().toLowerCase());
            const venueBusy = busyKey === `venue:${venue.identifier || venue.name}`;
            return (
              <li key={venue.identifier || venue.name}>
                <button
                  type="button"
                  onClick={() => void addVenue(venue)}
                  disabled={!followHydrated || venueBusy}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <MapPin className="h-4 w-4 text-momentum-flare" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{venue.name}</span>
                    {venue.city ? (
                      <span className="block truncate text-xs text-gray-400">{venue.city}</span>
                    ) : null}
                  </span>
                  <FollowSearchActionLabel following={alreadyFollowing} loading={venueBusy} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {kind === 'friend' && friends.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {friends.map((friend) => {
            const alreadyFollowing = isFollowing(friend.mocha_user_id);
            const friendBusy =
              busyKey === `friend:${friend.mocha_user_id}` || isUserFollowLoading(friend.mocha_user_id);
            return (
              <li key={friend.mocha_user_id}>
                <button
                  type="button"
                  onClick={() => void addFriend(friend)}
                  disabled={!followHydrated || friendBusy}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
                  <UserAvatar
                    imageUrl={friend.profile_image_url}
                    displayName={friend.display_name}
                    seed={friend.mocha_user_id}
                    alt={friend.display_name || 'User'}
                    sizeClass="h-10 w-10"
                    letterClassName="text-sm font-semibold"
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-white">
                    {friend.display_name || 'User'}
                  </span>
                  <FollowSearchActionLabel following={alreadyFollowing} loading={friendBusy} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {kind === 'song' && songs.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {songs.map((song) => {
            const alreadyFollowing = followedSongSlugs.has(song.slug.toLowerCase());
            const songBusy = busyKey === `song:${song.slug}`;
            return (
              <li key={song.slug}>
                <button
                  type="button"
                  onClick={() => void addSong(song)}
                  disabled={songBusy}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <Music className="h-4 w-4 text-momentum-flare" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{song.title}</span>
                    {song.artist_name ? (
                      <span className="block truncate text-xs text-gray-400">{song.artist_name}</span>
                    ) : null}
                  </span>
                  <FollowSearchActionLabel following={alreadyFollowing} loading={songBusy} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {status ? <p className="mt-3 text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
