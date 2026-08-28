import { useEffect, useState } from 'react';
import { Loader2, MapPin, Music, Plus, Search } from 'lucide-react';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import UserAvatar from '@/react-app/components/UserAvatar';

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
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 350);
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<UnifiedArtist[]>([]);
  const [venues, setVenues] = useState<UnifiedVenue[]>([]);
  const [friends, setFriends] = useState<UnifiedFriend[]>([]);
  const [songs, setSongs] = useState<UnifiedSong[]>([]);
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

  const added = (message: string) => {
    setStatus(message);
    setError(null);
    window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    window.dispatchEvent(new CustomEvent('following-changed'));
  };

  const addArtist = async (name: string) => {
    setBusyKey(`artist:${name}`);
    try {
      const res = await apiFetch('/api/users/me/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'artist', name }),
      });
      if (!res.ok) throw new Error(await res.text());
      added(`Following ${name}`);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not add artist'));
    } finally {
      setBusyKey(null);
    }
  };

  const addVenue = async (venue: UnifiedVenue) => {
    setBusyKey(`venue:${venue.identifier || venue.name}`);
    try {
      const res = await apiFetch('/api/users/me/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'venue',
          name: venue.name,
          jambase_id: venue.identifier || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      added(`Following ${venue.name}`);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not add venue'));
    } finally {
      setBusyKey(null);
    }
  };

  const addSong = async (song: UnifiedSong) => {
    setBusyKey(`song:${song.slug}`);
    try {
      const res = await apiFetch('/api/users/me/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'song', name: song.title || song.slug }),
      });
      if (!res.ok) throw new Error(await res.text());
      added(`Following ${song.title}`);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not save song'));
    } finally {
      setBusyKey(null);
    }
  };

  const addFriend = async (friend: UnifiedFriend) => {
    setBusyKey(`friend:${friend.mocha_user_id}`);
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(friend.mocha_user_id)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(await res.text());
      added(`Following ${friend.display_name || 'friend'}`);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not follow user'));
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
          {artists.map((artist) => (
            <li key={artist.identifier || artist.name}>
              <button
                type="button"
                onClick={() => void addArtist(artist.name)}
                disabled={busyKey === `artist:${artist.name}`}
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
                <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {kind === 'venue' && venues.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {venues.map((venue) => (
            <li key={venue.identifier || venue.name}>
              <button
                type="button"
                onClick={() => void addVenue(venue)}
                disabled={busyKey === `venue:${venue.identifier || venue.name}`}
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
                <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {kind === 'friend' && friends.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {friends.map((friend) => (
            <li key={friend.mocha_user_id}>
              <button
                type="button"
                onClick={() => void addFriend(friend)}
                disabled={busyKey === `friend:${friend.mocha_user_id}`}
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
                <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {kind === 'song' && songs.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {songs.map((song) => (
            <li key={song.slug}>
              <button
                type="button"
                onClick={() => void addSong(song)}
                disabled={busyKey === `song:${song.slug}`}
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
                <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {status ? <p className="mt-3 text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
