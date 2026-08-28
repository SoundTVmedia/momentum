import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ImagePlus, Loader2, MapPin, Music, Plus, Search, Ticket, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { apiFetch, apiFetchErrorMessage } from '@/react-app/lib/apiFetch';
import { artistPath } from '@/shared/app-paths';
import UserAvatar from '@/react-app/components/UserAvatar';

type UnifiedArtist = { identifier: string; name: string; image: string | null };
type UnifiedVenue = { identifier: string; name: string; city: string; image: string | null };
type UnifiedShow = {
  identifier: string;
  name: string;
  startDate: string;
  artistName: string;
  venueName: string;
  image: string | null;
};
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
type FollowedArtist = { name: string; image_url: string | null };

type ManualShow = {
  artist: string;
  venue: string;
  city: string;
  date: string;
  notes: string;
};

const EMPTY_MANUAL: ManualShow = { artist: '', venue: '', city: '', date: '', notes: '' };

export default function UnifiedFavoritesAdd() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 350);
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<UnifiedArtist[]>([]);
  const [venues, setVenues] = useState<UnifiedVenue[]>([]);
  const [shows, setShows] = useState<UnifiedShow[]>([]);
  const [friends, setFriends] = useState<UnifiedFriend[]>([]);
  const [songs, setSongs] = useState<UnifiedSong[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<ManualShow>(EMPTY_MANUAL);
  const [stubFile, setStubFile] = useState<File | null>(null);
  const [savingShow, setSavingShow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounced.length < 2) {
      setArtists([]);
      setVenues([]);
      setShows([]);
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
          shows?: UnifiedShow[];
          friends?: UnifiedFriend[];
          songs?: UnifiedSong[];
        };
        if (cancelled) return;
        setArtists(data.artists ?? []);
        setVenues(data.venues ?? []);
        setShows(data.shows ?? []);
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

  const added = useCallback((message: string) => {
    setStatus(message);
    setError(null);
    window.dispatchEvent(new CustomEvent('favorite-artists-changed'));
    window.dispatchEvent(new CustomEvent('following-changed'));
  }, []);

  const loadFollowedArtists = useCallback(async () => {
    try {
      const res = await apiFetch('/api/users/me/favorite-artists', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { artists?: { name?: string | null; image_url?: string | null }[] };
      setFollowedArtists(
        (data.artists ?? [])
          .map((row) => ({
            name: (row.name ?? '').trim(),
            image_url: row.image_url ?? null,
          }))
          .filter((row) => row.name),
      );
    } catch {
      /* keep current list */
    }
  }, []);

  useEffect(() => {
    void loadFollowedArtists();
    const refresh = () => void loadFollowedArtists();
    window.addEventListener('favorite-artists-changed', refresh);
    return () => window.removeEventListener('favorite-artists-changed', refresh);
  }, [loadFollowedArtists]);

  const addArtist = async (name: string) => {
    setBusyKey(`artist:${name}`);
    try {
      const res = await apiFetch('/api/users/me/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'artist', name }),
      });
      if (!res.ok) throw new Error(await res.text());
      added(`Added ${name}`);
      void loadFollowedArtists();
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not add artist'));
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

  const uploadStub = async (): Promise<{ url: string | null; key: string | null }> => {
    if (!stubFile) return { url: null, key: null };
    const form = new FormData();
    form.append('file', stubFile);
    form.append('type', 'thumbnail');
    const res = await apiFetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Ticket stub upload failed');
    const data = (await res.json()) as { url?: string; key?: string };
    return { url: data.url ?? null, key: data.key ?? null };
  };

  const saveShow = async (payload: Record<string, unknown>) => {
    setSavingShow(true);
    setError(null);
    try {
      const stub = await uploadStub();
      const res = await apiFetch('/api/archival-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          stub_image_url: stub.url,
          stub_r2_key: stub.key,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not save show');
      }
      added('Archival show saved');
      setManualOpen(false);
      setManual(EMPTY_MANUAL);
      setStubFile(null);
    } catch (err) {
      setError(apiFetchErrorMessage(err, 'Could not save show'));
    } finally {
      setSavingShow(false);
    }
  };

  const addMatchedShow = async (show: UnifiedShow) => {
    setBusyKey(`show:${show.identifier}`);
    try {
      await saveShow({
        jambase_event_id: show.identifier,
        artist_name: show.artistName,
        venue_name: show.venueName,
        start_date: show.startDate,
        event_title: show.name,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const submitManualShow = async () => {
    if (!manual.artist.trim() || !manual.venue.trim() || !manual.date.trim()) {
      setError('Artist, venue, and date are required');
      return;
    }
    const matchRes = await apiFetch('/api/archival-shows/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist: manual.artist,
        venue: manual.venue,
        date: manual.date,
      }),
    });
    const matchBody = (await matchRes.json().catch(() => ({}))) as {
      match?: { identifier?: string } | null;
    };
    const matchedId =
      typeof matchBody.match?.identifier === 'string' ? matchBody.match.identifier : null;
    await saveShow({
      jambase_event_id: matchedId,
      artist_name: manual.artist,
      venue_name: manual.venue,
      city: manual.city,
      start_date: manual.date,
      setlist_notes: manual.notes,
    });
  };

  const hasResults = artists.length + venues.length + shows.length + friends.length + songs.length > 0;
  const followedNameSet = new Set(followedArtists.map((a) => a.name.toLowerCase()));

  return (
    <div>
      <p className="text-sm text-gray-300 mb-3">
        Search artists, friends, venues, songs, and shows to follow.
      </p>
      {followedArtists.length > 0 ? (
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Artists you follow
          </h3>
          <div className="flex flex-wrap gap-2">
            {followedArtists.map((artist) => (
              <button
                key={artist.name}
                type="button"
                onClick={() => navigate(artistPath(artist.name))}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-momentum-flare/35 bg-momentum-flare/10 px-3 py-1.5 text-sm text-white hover:bg-momentum-flare/20"
              >
                {artist.image_url ? (
                  <img src={artist.image_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : null}
                <span className="truncate">{artist.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <p className="mb-3 text-xs text-gray-500">You are not following any artists yet.</p>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists, friends, venues, songs, or shows"
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
        <p className="mt-4 text-sm text-gray-400">No catalog matches. You can still add a show below.</p>
      ) : null}

      {artists.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Music className="w-3.5 h-3.5" />
            Artists
          </h3>
          <ul className="space-y-2">
            {artists.map((artist) => {
              const alreadyFollowing = followedNameSet.has(artist.name.toLowerCase());
              return (
              <li key={artist.identifier || artist.name}>
                <button
                  type="button"
                  onClick={() => void addArtist(artist.name)}
                  disabled={busyKey === `artist:${artist.name}` || alreadyFollowing}
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
                  {alreadyFollowing ? (
                    <span className="shrink-0 text-xs font-medium text-momentum-flare">Following</span>
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
                  )}
                </button>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {friends.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Users className="w-3.5 h-3.5" />
            Friends
          </h3>
          <ul className="space-y-2">
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">
                      {friend.display_name || 'User'}
                    </span>
                    {friend.clip_count > 0 ? (
                      <span className="block truncate text-xs text-gray-400">
                        {friend.clip_count} clip{friend.clip_count !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {songs.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Music className="w-3.5 h-3.5" />
            Songs
          </h3>
          <ul className="space-y-2">
            {songs.map((song) => (
              <li key={song.slug}>
                <button
                  type="button"
                  onClick={() => void addSong(song)}
                  disabled={busyKey === `song:${song.slug}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
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
        </section>
      ) : null}

      {venues.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            Venues
          </h3>
          <ul className="space-y-2">
            {venues.map((venue) => (
              <li key={venue.identifier || venue.name}>
                <button
                  type="button"
                  onClick={() => void addVenue(venue)}
                  disabled={busyKey === `venue:${venue.identifier || venue.name}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
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
        </section>
      ) : null}

      {shows.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            Archival shows
          </h3>
          <ul className="space-y-2">
            {shows.map((show) => (
              <li key={show.identifier || show.name}>
                <button
                  type="button"
                  onClick={() => void addMatchedShow(show)}
                  disabled={Boolean(busyKey && busyKey.startsWith('show:')) || savingShow}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{show.name}</span>
                    <span className="block truncate text-xs text-gray-400">
                      {[show.venueName, show.startDate.slice(0, 10)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-momentum-flare" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          className="text-sm font-medium text-momentum-flare hover:text-white"
        >
          {manualOpen ? 'Hide manual show form' : 'Add a show that isn’t listed'}
        </button>
        {manualOpen ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={manual.artist}
              onChange={(e) => setManual((m) => ({ ...m, artist: e.target.value }))}
              placeholder="Artist"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white placeholder:text-white/40"
            />
            <input
              value={manual.venue}
              onChange={(e) => setManual((m) => ({ ...m, venue: e.target.value }))}
              placeholder="Venue"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white placeholder:text-white/40"
            />
            <input
              value={manual.city}
              onChange={(e) => setManual((m) => ({ ...m, city: e.target.value }))}
              placeholder="City"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white placeholder:text-white/40"
            />
            <input
              type="date"
              value={manual.date}
              onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white"
            />
            <textarea
              value={manual.notes}
              onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))}
              placeholder="Setlist notes (optional)"
              className="sm:col-span-2 min-h-[72px] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-base text-white placeholder:text-white/40"
            />
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setStubFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                <ImagePlus className="h-4 w-4" />
                {stubFile ? stubFile.name : 'Upload ticket stub'}
              </button>
              <button
                type="button"
                disabled={savingShow}
                onClick={() => void submitManualShow()}
                className="inline-flex items-center gap-2 rounded-lg momentum-grad-interactive px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingShow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                Save show
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {status ? <p className="mt-3 text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
